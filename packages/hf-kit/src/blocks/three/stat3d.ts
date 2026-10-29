import type { z } from "zod";
import type { BlockFn } from "../types";
import type { Stat3DData } from "./schema";
import { titleCss, titleHtml } from "../common";
import { esc, fitFontSize, formatNumber, js, r3 } from "../../util";
import { FONTS_3D, type Font3D } from "./font.data";
import { canvasCss, canvasHtml, driver, guard, isHanddrawnSkin, prelude, type Rect } from "./runtime";

type D = z.infer<typeof Stat3DData>;

/** The string stat-3d extrudes (counter formatting for numbers). */
export function stat3dText(d: D): string {
  const core = typeof d.value === "number" ? formatNumber(d.value, d.decimals) : d.value.trim();
  return `${d.prefix}${core}${d.suffix}`;
}

/** Glyph subset for `text` (unknown characters fall back to the space advance). */
export function glyphSubset(font: Font3D, text: string): { upm: number; cap: number; g: Record<string, { ha: number; o: string }> } {
  const g: Record<string, { ha: number; o: string }> = {};
  for (const ch of new Set([...text])) g[ch] = font.glyphs[ch] ?? font.glyphs[ch.toUpperCase()] ?? font.glyphs[" "] ?? { ha: font.unitsPerEm * 0.3, o: "" };
  return { upm: font.unitsPerEm, cap: font.capHeight || font.unitsPerEm * 0.7, g };
}

/**
 * A number or short phrase as extruded 3D type (bundled Inter ExtraBold / Excalifont outlines → THREE.ShapePath
 * → ExtrudeGeometry; no font fetch at render time). Swings in from a three-quarter angle, settles facing the
 * camera with a slow sway, lit by the skin accent. Sub-label below in DOM type.
 */
export const stat3d: BlockFn<D> = (ctx) => {
  const { sid, box, anim } = ctx;
  const d = ctx.data;
  const text = stat3dText(d);
  const t = titleHtml(ctx, ctx.headline);
  const lblSize = d.label ? fitFontSize(d.label, { maxWidth: box.w, maxLines: 2, base: ctx.type.body + 4, min: ctx.type.label }) : 0;
  const lblLines = d.label ? Math.min(2, Math.ceil((d.label.length * lblSize * 0.56) / box.w) || 1) : 0;
  const lblH = d.label ? Math.round(lblLines * lblSize * 1.25 + 40) : 0;
  const rect: Rect = { x: 0, y: box.y + t.h, w: ctx.width, h: Math.max(360, Math.min(820, box.h - t.h - lblH)) };
  // DOM fallback (shown only when the Three.js runtime is unavailable, e.g. an offline preview).
  const fbSize = fitFontSize(text, { maxWidth: box.w, base: ctx.type.hero + 40, min: ctx.type.m, factor: 0.62 });
  const font = FONTS_3D[isHanddrawnSkin(ctx.skin) ? "hand" : "sans"];
  const sub = glyphSubset(font, text);

  const meta = { block: "stat-3d", objects: 1, labels: [text], durationMs: Math.round(ctx.durationS * 1000) };
  const html = `
      ${t.html}
      ${canvasHtml(sid, rect, meta)}
      <div id="${sid}-fb" class="${sid}-display ${sid}-fb" style="font-size:${fbSize}px">${esc(text)}</div>
      ${d.label ? `<div id="${sid}-lbl" class="${sid}-lbl" style="font-size:${lblSize}px">${esc(d.label)}</div>` : ""}`;
  const css = `
    ${titleCss(ctx)}
    ${canvasCss(sid, rect)}
    #${sid}-fb { position: absolute; left: ${box.x}px; top: ${rect.y}px; width: ${box.w}px; height: ${rect.h}px; display: flex; align-items: center; justify-content: center; color: var(--accent); font-weight: 900; white-space: nowrap; }
    #${sid}-lbl { position: absolute; left: ${box.x}px; top: ${rect.y + rect.h + 8}px; width: ${box.w}px; text-align: center; color: var(--muted); line-height: 1.25; }
  `;

  const s0 = ctx.isFirst ? 0.05 : 0.25;
  const settle = Math.max(0.9, Math.min(1.8, ctx.motion.dur * 2.6));
  if (t.html) anim.enter(`#${sid}-title`, ctx.isFirst ? 0 : 0.1, { from: "up", dist: 30 });
  if (d.label) anim.enter(`#${sid}-lbl`, s0 + settle * 0.7, { from: "up", dist: 24 });

  const three = `${prelude(ctx, rect, { fov: 28, lights: "stat" })}
      var fb = document.getElementById(${js(`${sid}-fb`)}); if (fb) fb.style.visibility = "hidden";
      var FONT = ${js(sub)}, TXT = ${js([...text])}, S0 = ${r3(s0)}, SET = ${r3(settle)}, FRAME = ${r3(box.w / ctx.width)};
      var sc = 1 / FONT.upm, x = 0, shapes = [];
      TXT.forEach(function (ch) {
        var gl = FONT.g[ch]; if (!gl) return;
        var o = gl.o ? gl.o.split(" ") : [], sp = new T.ShapePath(), i = 0;
        while (i < o.length) {
          var c = o[i++];
          if (c === "m") sp.moveTo(o[i++] * sc + x, o[i++] * sc);
          else if (c === "l") sp.lineTo(o[i++] * sc + x, o[i++] * sc);
          else if (c === "q") { var qx = o[i++] * sc + x, qy = o[i++] * sc, q1x = o[i++] * sc + x, q1y = o[i++] * sc; sp.quadraticCurveTo(q1x, q1y, qx, qy); }
          else if (c === "b") { var bx = o[i++] * sc + x, by = o[i++] * sc, b1x = o[i++] * sc + x, b1y = o[i++] * sc, b2x = o[i++] * sc + x, b2y = o[i++] * sc; sp.bezierCurveTo(b1x, b1y, b2x, b2y, bx, by); }
        }
        if (o.length) Array.prototype.push.apply(shapes, sp.toShapes());
        x += gl.ha * sc;
      });
      var geo = new T.ExtrudeGeometry(shapes, { depth: 0.26, curveSegments: 6, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.016, bevelSegments: 2 });
      geo.computeBoundingBox(); var bb = geo.boundingBox;
      geo.translate(-(bb.min.x + bb.max.x) / 2, -FONT.cap * sc / 2, -0.13);
      var face = mat(PAL.accent, { emissive: new T.Color(PAL.accent), emissiveIntensity: HAND ? 0.0 : 0.18 });
      var side = mat(new T.Color(PAL.accent).lerp(new T.Color(PAL.bg), 0.5).getHex());
      var word = new T.Mesh(geo, [face, side]); edge(word, PAL.ink);
      var holder = new T.Group(); holder.add(word); S.add(holder);
      var glow = new T.PointLight(new T.Color(PAL.accent2), 6, 12, 1.6); glow.position.set(0, 0.2, 2.2); S.add(glow);
      var tw = (bb.max.x - bb.min.x) + 0.1, th = FONT.cap * sc + 0.1;
      var DIST = fitCam(C, tw / 2 / (FRAME * 0.9), th / 2 / 0.62);
      C.position.set(0, 0, DIST); C.lookAt(0, 0, 0);
      function update(t) {
        var e = EIN(seg(t, S0, SET)), r = EIO(seg(t, S0, SET * 1.15));
        var after = Math.max(0, t - S0 - SET);
        holder.rotation.y = lerp(-1.15, -0.14, r) + 0.1 * Math.sin(after * 0.9) * Math.min(1, after);
        holder.rotation.x = lerp(0.55, 0.07, r) + 0.03 * Math.sin(after * 0.7);
        holder.position.z = lerp(-DIST * 0.6, 0, E3(seg(t, S0, SET)));
        holder.scale.setScalar(Math.max(0.001, lerp(0.55, 1, e)));
        word.visible = t >= S0;
        glow.position.x = lerp(-2.4, 1.4, EIO(seg(t, S0, DUR - S0)));
      }${driver(ctx)}`;

  anim.raw(guard(three));
  return { html, css, timeline: anim.out() };
};
