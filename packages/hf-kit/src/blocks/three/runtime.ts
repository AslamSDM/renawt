/**
 * Shared Three.js bootstrap for the 3D blocks.
 *
 * Render contract (HyperFrames): every frame is a pure function of the scene's local time.
 *  - Three.js r158 UMD (window.THREE) is loaded once in index.html from a pinned CDN URL (THREE_CDN).
 *  - Each 3D scene owns one <canvas> with fixed pixel size, pixel ratio 1 and preserveDrawingBuffer.
 *  - No requestAnimationFrame / clock: `draw(t)` is called from (a) an `onUpdate` on a no-op tween that
 *    spans the scene's paused GSAP timeline and (b) the runtime's `hf-seek` event (three adapter), using
 *    the host's data-start to turn global time into scene time. Both paths compute the same t.
 *  - Scene state is rebuilt from t on every draw (no accumulation), so random seeks are exact.
 */
import type { VisualSkin } from "@remawt/shared";
import type { BlockCtx } from "../types";
import { esc, js, r3 } from "../../util";

/** Pinned Three.js build. r158 is the last release that ships the classic (window.THREE) build. */
export const THREE_VERSION = "0.158.0";
export const THREE_CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.min.js`;
/** Marker attribute on every 3D canvas (JSON summary read by lint). */
export const THREE_ATTR = "data-remawt-3d";

export interface Palette3D { bg: string; surface: string; ink: string; accent: string; accent2: string; muted: string; line: string }

function hex6(c: string): string {
  const h = String(c || "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) return `#${h.split("").map((x) => x + x).join("")}`.toLowerCase();
  if (/^[0-9a-f]{6}/i.test(h)) return `#${h.slice(0, 6)}`.toLowerCase();
  return "#888888";
}
/** sRGB mix like CSS color-mix(in srgb, a p%, b). */
export function mixHex(a: string, b: string, p: number): string {
  const A = hex6(a), B = hex6(b);
  const ch = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(ch(A, i) * p + ch(B, i) * (1 - p)).toString(16).padStart(2, "0")).join("")}`;
}

/** Skin palette resolved to hex for WebGL (same mixes as the CSS --muted / --line tokens). */
export function palette3d(skin: VisualSkin): Palette3D {
  const p = skin.palette;
  return {
    bg: hex6(p.bg), surface: hex6(p.surface), ink: hex6(p.ink), accent: hex6(p.accent), accent2: hex6(p.accent2 ?? p.accent),
    muted: mixHex(p.ink, p.bg, 0.58), line: mixHex(p.ink, p.bg, 0.16),
  };
}

export const isHanddrawnSkin = (skin: VisualSkin) => !!(skin as { handdrawn?: boolean }).handdrawn;

export interface Rect { x: number; y: number; w: number; h: number }

/** Canvas + label overlay markup. `meta` is a small JSON summary for lint. */
export function canvasHtml(sid: string, rect: Rect, meta: Record<string, unknown>, overlay = ""): string {
  return `<canvas id="${sid}-gl" class="${sid}-gl" width="${rect.w}" height="${rect.h}" ${THREE_ATTR}="${esc(JSON.stringify(meta))}"></canvas>
      <div id="${sid}-ov" class="${sid}-ov">${overlay}</div>`;
}

export function canvasCss(sid: string, rect: Rect): string {
  return `
    #${sid}-gl { position: absolute; left: ${rect.x}px; top: ${rect.y}px; width: ${rect.w}px; height: ${rect.h}px; display: block; }
    #${sid}-ov { position: absolute; left: ${rect.x}px; top: ${rect.y}px; width: ${rect.w}px; height: ${rect.h}px; pointer-events: none; }
    .${sid}-tag { position: absolute; left: 0; top: 0; will-change: transform; }
  `;
}

/** Entrance ease per motion preset (JS function name defined in the prelude). */
function easeName(motion: string): string {
  return motion === "playful" ? "EB" : motion === "snappy" ? "E4" : motion === "smooth" ? "EIO" : "EX";
}

/**
 * JS prelude (runs inside the scene's IIFE, after `var tl` exists): renderer, scene, camera, lights,
 * material helpers, easing, projection. Defines T, R, S, C, W, H, PAL, mat(), edge(), proj(), tag().
 */
export function prelude(ctx: BlockCtx, rect: Rect, o: { fov?: number; lights?: "standard" | "stat" } = {}): string {
  const pal = palette3d(ctx.skin);
  const hand = isHanddrawnSkin(ctx.skin);
  const sid = ctx.sid;
  return `
      var T = window.THREE, W = ${rect.w}, H = ${rect.h}, DUR = ${r3(ctx.durationS)}, PAL = ${js(pal)}, HAND = ${hand};
      var cv = document.getElementById(${js(`${sid}-gl`)});
      var R = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
      R.setPixelRatio(1); R.setSize(W, H, false); R.setClearColor(0x000000, 0);
      var S = new T.Scene();
      var C = new T.PerspectiveCamera(${o.fov ?? 32}, W / H, 0.05, 200);
      var hemi = new T.HemisphereLight(0xffffff, new T.Color(PAL.bg), HAND ? 1.1 : 1.35); S.add(hemi);
      var key = new T.DirectionalLight(0xffffff, HAND ? 2.0 : 2.4); key.position.set(4, 7, 6); S.add(key);
      var rim = new T.DirectionalLight(new T.Color(PAL.accent), ${o.lights === "stat" ? 2.2 : 0.9}); rim.position.set(-6, 3, -4); S.add(rim);
      var GRAD = null;
      if (HAND) { var gd = new Uint8Array([90, 170, 255]); GRAD = new T.DataTexture(gd, 3, 1, T.RedFormat); GRAD.minFilter = T.NearestFilter; GRAD.magFilter = T.NearestFilter; GRAD.needsUpdate = true; }
      function mat(hex, extra) {
        var m = HAND ? new T.MeshToonMaterial({ color: new T.Color(hex), gradientMap: GRAD }) : new T.MeshStandardMaterial({ color: new T.Color(hex), roughness: 0.48, metalness: 0.06 });
        if (extra) for (var k in extra) m[k] = extra[k];
        return m;
      }
      // Hand-drawn skins: ink creases + an inverted-hull outline so smooth shapes (spheres) also get a contour.
      function edge(mesh, hex) {
        if (!HAND) return;
        var ink = new T.Color(hex || PAL.ink);
        mesh.add(new T.LineSegments(new T.EdgesGeometry(mesh.geometry, 28), new T.LineBasicMaterial({ color: ink })));
        var hull = new T.Mesh(mesh.geometry, new T.MeshBasicMaterial({ color: ink, side: T.BackSide }));
        hull.scale.setScalar(1.045); mesh.add(hull);
      }
      function cl(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
      function seg(t, a, d) { return d <= 0 ? (t >= a ? 1 : 0) : cl((t - a) / d); }
      function lerp(a, b, u) { return a + (b - a) * u; }
      function E3(x) { x = cl(x); return 1 - Math.pow(1 - x, 3); }
      function E4(x) { x = cl(x); return 1 - Math.pow(1 - x, 4); }
      function EX(x) { x = cl(x); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); }
      function EIO(x) { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
      function EB(x) { x = cl(x); var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
      var EIN = ${easeName(ctx.motion.name)};
      var _pv = new T.Vector3();
      function proj(x, y, z) { _pv.set(x, y, z).project(C); return [(_pv.x * 0.5 + 0.5) * W, (-_pv.y * 0.5 + 0.5) * H, _pv.z]; }
      function tag(id, x, y, op) {
        var el = document.getElementById(id); if (!el) return;
        el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
        if (op !== undefined) el.style.opacity = String(Math.round(cl(op) * 1000) / 1000);
      }
      function fitCam(cam, halfW, halfH) {
        var vf = cam.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * cam.aspect);
        return Math.max(halfW / Math.tan(hf), halfH / Math.tan(vf));
      }`;
}

/** Time driver: GSAP onUpdate + hf-seek → draw(t). Must come after `function update(t)` is defined. */
export function driver(ctx: BlockCtx): string {
  return `
      var _host = document.querySelector(${js(`[data-composition-id="${ctx.sid}"][data-start]`)});
      var _start = _host ? Number(_host.getAttribute("data-start")) : NaN;
      var _last = -1;
      function draw(t) {
        t = Math.max(0, Math.min(DUR, Math.round((Number(t) || 0) * 1000) / 1000));
        if (t === _last) return;
        _last = t; update(t); R.render(S, C);
      }
      tl.to({}, { duration: DUR, ease: "none", onUpdate: function () { draw(tl.time()); } }, 0);
      window.addEventListener("hf-seek", function (e) {
        var g = e && e.detail && typeof e.detail.time === "number" ? e.detail.time : NaN;
        draw(isFinite(_start) && isFinite(g) ? g - _start : tl.time());
      });
      draw(0);`;
}

/**
 * Wrap Three code so a missing runtime (offline preview) or a browser without WebGL degrades to the DOM layers
 * (titles, labels, stat-3d's flat fallback) instead of throwing before the timeline is registered.
 */
export function guard(code: string): string {
  return `if (window.THREE) { try {${code}
      } catch (err) { if (window.console) console.warn("remawt 3D scene disabled:", err && err.message); } }`;
}

/** `<script src>` for index.html when any scene uses a 3D block. */
export function threeScriptTag(blocks: string[]): string {
  return blocks.some((b) => b.endsWith("-3d")) ? `<script src="${THREE_CDN}"></script>` : "";
}

/** Split a unit template into [before, after] around the number (mirrors common.withUnit). */
export function unitParts(unit: string): [string, string] {
  if (!unit) return ["", ""];
  if (/^[$€£¥₹]$/.test(unit)) return [unit, ""];
  if (unit === "%") return ["", "%"];
  return ["", ` ${unit}`];
}
