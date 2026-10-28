/**
 * Node.js cursor overlay processing — replaces the Python CV service /process endpoint.
 * Handles cursor position interpolation, original cursor blur, and custom cursor overlay
 * using sharp for image processing.
 */

import sharp from "sharp";
import { readFile } from "fs/promises";
import { join } from "path";

const ASSETS_DIR = join(__dirname, "..", "cv-services", "cursor-detector", "assets");

// Cached cursor image buffers (loaded once)
const cursorImageCache: Map<string, { buffer: Buffer; width: number; height: number } | null> = new Map();

interface CursorEvent {
  timestamp: number;
  x?: number;
  y?: number;
  coord_x?: number;
  coord_y?: number;
  type?: string;
}

interface ZoomPoint {
  time: number;
  x: number;
  y: number;
  scale: number;
  duration: number;
}

/**
 * Load and cache cursor PNG image
 */
async function loadCursorImage(
  style: string
): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  if (cursorImageCache.has(style)) {
    return cursorImageCache.get(style)!;
  }

  const filename = `cursor_${style}.png`;
  const path = join(ASSETS_DIR, filename);

  try {
    const fileBuffer = await readFile(path);
    const metadata = await sharp(fileBuffer).metadata();
    const result = {
      buffer: fileBuffer,
      width: metadata.width || 24,
      height: metadata.height || 24,
    };
    cursorImageCache.set(style, result);
    return result;
  } catch {
    console.warn(`[CursorOverlay] Cursor image not found: ${path}`);
    cursorImageCache.set(style, null);
    return null;
  }
}

/**
 * Linear interpolation between cursor events.
 * Returns { x, y, isClick } for a given time in milliseconds.
 */
export function interpolateCursorPosition(
  cursorData: CursorEvent[],
  timeMs: number
): { x: number; y: number; isClick: boolean } {
  if (!cursorData || cursorData.length === 0) {
    return { x: -1, y: -1, isClick: false };
  }

  const getX = (p: CursorEvent) => p.x ?? p.coord_x ?? 0;
  const getY = (p: CursorEvent) => p.y ?? p.coord_y ?? 0;

  // Before first event
  if (timeMs <= cursorData[0].timestamp) {
    const p = cursorData[0];
    return { x: getX(p), y: getY(p), isClick: p.type === "click" };
  }

  // After last event
  if (timeMs >= cursorData[cursorData.length - 1].timestamp) {
    const p = cursorData[cursorData.length - 1];
    return { x: getX(p), y: getY(p), isClick: false };
  }

  // Find surrounding events and interpolate
  for (let i = 0; i < cursorData.length - 1; i++) {
    const t0 = cursorData[i].timestamp;
    const t1 = cursorData[i + 1].timestamp;

    if (t0 <= timeMs && timeMs <= t1) {
      const alpha = t1 === t0 ? 0 : (timeMs - t0) / (t1 - t0);
      const p0 = cursorData[i];
      const p1 = cursorData[i + 1];

      const x = getX(p0) + (getX(p1) - getX(p0)) * alpha;
      const y = getY(p0) + (getY(p1) - getY(p0)) * alpha;
      const isClick = p0.type === "click" && alpha < 0.3;

      return { x, y, isClick };
    }
  }

  return { x: -1, y: -1, isClick: false };
}

/**
 * Cubic ease-in-out for zoom transitions
 */
function easeInOut(t: number): number {
  if (t < 0.5) return 4 * t * t * t;
  return 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Find active zoom at a given time (seconds).
 * Returns { cx, cy, scale } with easing applied.
 */
export function getActiveZoom(
  zoomPoints: ZoomPoint[],
  timeSec: number
): { cx: number; cy: number; scale: number } {
  for (const zp of zoomPoints) {
    const start = zp.time;
    const end = start + zp.duration;

    if (start <= timeSec && timeSec <= end) {
      const progress = (timeSec - start) / zp.duration;
      let ease: number;

      if (progress < 0.15) {
        ease = easeInOut(progress / 0.15);
      } else if (progress > 0.85) {
        ease = easeInOut(1.0 - (progress - 0.85) / 0.15);
      } else {
        ease = 1.0;
      }

      return {
        cx: zp.x,
        cy: zp.y,
        scale: 1.0 + (zp.scale - 1.0) * ease,
      };
    }
  }

  return { cx: 0.5, cy: 0.5, scale: 1.0 };
}

/**
 * Process a single raw video frame: blur the original cursor region and overlay
 * the custom cursor PNG. Input/output are raw RGBA pixel buffers.
 *
 * @param frameBuffer  Raw RGBA pixel data (width * height * 4 bytes)
 * @param width        Frame width in pixels
 * @param height       Frame height in pixels
 * @param cursorX      Cursor x position (pixels)
 * @param cursorY      Cursor y position (pixels)
 * @param isClick      Whether this frame is during a click
 * @param cursorStyle  "normal" or "hand"
 * @param zoomCx       Zoom center X (normalized 0-1)
 * @param zoomCy       Zoom center Y (normalized 0-1)
 * @param zoomScale    Zoom scale (1.0 = no zoom)
 */
export async function processFrame(
  frameBuffer: Buffer,
  width: number,
  height: number,
  cursorX: number,
  cursorY: number,
  isClick: boolean,
  cursorStyle: string,
  zoomCx: number = 0.5,
  zoomCy: number = 0.5,
  zoomScale: number = 1.0
): Promise<Buffer> {
  let processed = sharp(frameBuffer, {
    raw: { width, height, channels: 4 },
  });

  // Apply zoom crop if scale > 1
  if (zoomScale > 1.01) {
    const cropW = Math.round(width / zoomScale);
    const cropH = Math.round(height / zoomScale);
    const cx = Math.round(zoomCx * width);
    const cy = Math.round(zoomCy * height);
    const left = Math.max(0, Math.min(width - cropW, cx - Math.round(cropW / 2)));
    const top = Math.max(0, Math.min(height - cropH, cy - Math.round(cropH / 2)));

    processed = processed
      .extract({ left, top, width: cropW, height: cropH })
      .resize(width, height, { kernel: sharp.kernel.lanczos3 });

    // Adjust cursor position for zoom
    cursorX = (cursorX - left) * zoomScale;
    cursorY = (cursorY - top) * zoomScale;
  }

  if (cursorX < 0 || cursorY < 0) {
    return processed.raw().toBuffer();
  }

  const ix = Math.round(cursorX);
  const iy = Math.round(cursorY);

  // Build composite layers
  const composites: sharp.OverlayOptions[] = [];

  // 1. Blur original cursor region using a blurred patch overlay
  const blurRadius = 25;
  const blurX1 = Math.max(0, ix - blurRadius);
  const blurY1 = Math.max(0, iy - blurRadius);
  const blurX2 = Math.min(width, ix + blurRadius);
  const blurY2 = Math.min(height, iy + blurRadius);
  const blurW = blurX2 - blurX1;
  const blurH = blurY2 - blurY1;

  if (blurW > 0 && blurH > 0) {
    // Extract the region, blur it, and overlay it back
    const regionBuffer = await processed.clone()
      .extract({ left: blurX1, top: blurY1, width: blurW, height: blurH })
      .blur(15)
      .toBuffer();

    composites.push({
      input: regionBuffer,
      left: blurX1,
      top: blurY1,
    });
  }

  // 2. Click glow effect
  if (isClick) {
    const glowSize = 60;
    const glowBuffer = await sharp({
      create: {
        width: glowSize,
        height: glowSize,
        channels: 4,
        background: { r: 180, g: 130, b: 255, alpha: 0.3 },
      },
    })
      .blur(10)
      .png()
      .toBuffer();

    const glowLeft = Math.max(0, Math.min(width - glowSize, ix - glowSize / 2));
    const glowTop = Math.max(0, Math.min(height - glowSize, iy - glowSize / 2));

    composites.push({
      input: glowBuffer,
      left: Math.round(glowLeft),
      top: Math.round(glowTop),
      blend: "over" as const,
    });
  }

  // 3. Overlay custom cursor PNG
  const cursorImg = await loadCursorImage(cursorStyle);
  if (cursorImg) {
    const cursorLeft = Math.max(0, Math.min(width - cursorImg.width, ix));
    const cursorTop = Math.max(0, Math.min(height - cursorImg.height, iy));

    composites.push({
      input: cursorImg.buffer,
      left: cursorLeft,
      top: cursorTop,
      blend: "over" as const,
    });
  }

  if (composites.length > 0) {
    processed = processed.composite(composites);
  }

  return processed.raw().toBuffer();
}
