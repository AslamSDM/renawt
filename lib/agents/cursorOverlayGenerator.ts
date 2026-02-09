/**
 * Cursor tracking code generator for screen recordings
 * This module generates cursor overlay code for recording scenes
 */

export interface CursorEvent {
  x: number;
  y: number;
  timestamp: number;
  type: "move" | "click" | "input" | string;
}

export type CursorStyle = "normal" | "hand";

/**
 * Generate cursor tracking and overlay code for a recording scene
 */
export function generateCursorOverlayCode(
  cursorData: CursorEvent[],
  cursorStyle: CursorStyle,
  indent: string = "  "
): { cursorCode: string; cursorRenderCode: string } {
  if (cursorData.length === 0) {
    return { cursorCode: "", cursorRenderCode: "" };
  }

  // Generate cursor position calculation code
  const cursorCode = `
${indent}// Get cursor position at current time
${indent}const currentTimeMs = (frame / fps) * 1000;
${indent}const cursorEvents = ${JSON.stringify(cursorData)};
${indent}let cursorX = 0;
${indent}let cursorY = 0;
${indent}let isClicking = false;
${indent}
${indent}// Find cursor events surrounding current time
${indent}let before = cursorEvents[0];
${indent}let after = cursorEvents[cursorEvents.length - 1];
${indent}for (let i = 0; i < cursorEvents.length; i++) {
${indent}  if (cursorEvents[i].timestamp <= currentTimeMs) {
${indent}    before = cursorEvents[i];
${indent}  }
${indent}  if (cursorEvents[i].timestamp >= currentTimeMs && after.timestamp > cursorEvents[i].timestamp) {
${indent}    after = cursorEvents[i];
${indent}    break;
${indent}  }
${indent}}
${indent}
${indent}// Interpolate position
${indent}if (before && after && before !== after) {
${indent}  const timeDiff = after.timestamp - before.timestamp;
${indent}  const progress = timeDiff > 0 ? (currentTimeMs - before.timestamp) / timeDiff : 0;
${indent}  cursorX = before.x + (after.x - before.x) * progress;
${indent}  cursorY = before.y + (after.y - before.y) * progress;
${indent}  isClicking = before.type === "click" || after.type === "click";
${indent}} else if (before) {
${indent}  cursorX = before.x;
${indent}  cursorY = before.y;
${indent}  isClicking = before.type === "click";
${indent}}
${indent}
${indent}// Normalize to video coordinates (assuming 1920x1080 recording)
${indent}const videoWidth = 1920;
${indent}const videoHeight = 1080;
${indent}const normalizedX = (cursorX / window.innerWidth) * videoWidth;
${indent}const normalizedY = (cursorY / window.innerHeight) * videoHeight;`;

  // Generate cursor SVG based on style
  const cursorSvg = getCursorSvg(cursorStyle);

  const cursorRenderCode = `
${indent}{/* Cursor Overlay */}
${indent}<div style={{
${indent}  position: 'absolute',
${indent}  left: normalizedX,
${indent}  top: normalizedY,
${indent}  transform: 'translate(-10px, -10px)',
${indent}  pointerEvents: 'none',
${indent}  zIndex: 100,
${indent}  filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.25))',
${indent}}}>
${indent}  ${cursorSvg}
${indent}  {isClicking && (
${indent}    <div style={{
${indent}      position: 'absolute',
${indent}      left: '50%',
${indent}      top: '50%',
${indent}      width: 40,
${indent}      height: 40,
${indent}      marginLeft: -20,
${indent}      marginTop: -20,
${indent}      borderRadius: '50%',
${indent}      border: '3px solid rgba(255, 107, 157, 0.9)',
${indent}      backgroundColor: 'transparent',
${indent}      transform: 'scale(1.5)',
${indent}      opacity: 0.8,
${indent}      pointerEvents: 'none',
${indent}      boxShadow: '0 0 10px rgba(255, 107, 157, 0.9)',
${indent}    }} />
${indent}  )}
${indent}</div>`;

  return { cursorCode, cursorRenderCode };
}

function getCursorSvg(cursorStyle: CursorStyle): string {
  switch (cursorStyle) {
    case "normal":
      // Normal arrow cursor (Mac style)
      return `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ transform: 'translate(0, 0)' }}>
      <path d="M8.5 2.5L8.5 22.5L13.5 17.5L18.5 25.5L22.5 23.5L17.5 15.5L24.5 14.5L8.5 2.5Z" fill="white" stroke="black" strokeWidth="1.5" />
    </svg>`;
    
    case "hand":
    default:
      // Hand pointing cursor using handcursor.svg from public folder
      return `<img src="/handcursor.svg" width="64" height="64" style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.25))' }} />`;
  }
}
