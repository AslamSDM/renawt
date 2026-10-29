import type { z } from "zod";
import type { BlockFn } from "../types";
import type { Chart3DData } from "./schema";
import { titleCss, titleHtml, withUnit } from "../common";
import { esc, fitFontSize, formatNumber, js, r3 } from "../../util";
import { canvasCss, canvasHtml, driver, guard, prelude, unitParts, type Rect } from "./runtime";

type D = z.infer<typeof Chart3DData>;

/**
 * 3D column chart: extruded bars grow one after another on a ground plane while the camera makes a slow
 * partial orbit. Value tags (DOM, projected from the bar tops every frame) count up with the bar height
 * and land on exactly `withUnit(formatNumber(value, decimals), unit)` — the counter block's formatting.
 */
export const chart3d: BlockFn<D> = (ctx) => {
  const { sid, box, anim } = ctx;
  const d = ctx.data;
  const t = titleHtml(ctx, d.title ?? ctx.headline);
  const capH = d.caption ? 80 : 0;
  const rect: Rect = { x: 0, y: box.y + t.h, w: ctx.width, h: Math.max(320, box.h - t.h - capH) };
  const n = d.items.length;
  const decimals = Math.min(2, Math.max(0, ...d.items.map((it) => (String(it.value).split(".")[1] ?? "").length)));
  const finals = d.items.map((it) => withUnit(formatNumber(it.value, decimals), d.unit));
  const [pre, post] = unitParts(d.unit);
  const anyHi = d.items.some((it) => it.highlight);

  // Text fit: each column gets ~box.w / n px at the framing distance.
  const pitch = (box.w * 0.94) / n;
  const valSize = Math.min(...finals.map((f) => fitFontSize(f, { maxWidth: pitch * 0.74, base: n <= 4 ? 58 : 44, min: 22 })));
  const lblSize = Math.min(...d.items.map((it) => fitFontSize(it.label, { maxWidth: pitch * 0.7, maxLines: 2, base: n <= 4 ? 36 : 30, min: 22 })));

  const tags = d.items.map((it, i) => `
        <div id="${sid}-vw${i}" class="${sid}-tag"><div id="${sid}-v${i}" class="${sid}-val${it.highlight ? ` ${sid}-hi` : ""}" style="font-size:${valSize}px">${esc(finals[i])}</div></div>
        <div id="${sid}-lw${i}" class="${sid}-tag"><div id="${sid}-l${i}" class="${sid}-lbl" style="font-size:${lblSize}px;width:${Math.round(pitch * 0.74)}px">${esc(it.label)}</div></div>`).join("");

  const meta = { block: "chart-3d", objects: n, labels: d.items.map((it) => it.label), durationMs: Math.round(ctx.durationS * 1000) };
  const html = `
      ${t.html}
      ${canvasHtml(sid, rect, meta, tags)}
      ${d.caption ? `<div id="${sid}-cap" class="${sid}-cap">${esc(d.caption)}</div>` : ""}`;

  const css = `
    ${titleCss(ctx)}
    ${canvasCss(sid, rect)}
    .${sid}-val { transform: translate(-50%, -100%); font-family: var(--font-display); font-weight: 800; color: var(--ink); white-space: nowrap; line-height: 1; font-variant-numeric: tabular-nums; text-shadow: 0 2px 14px var(--bg); }
    .${sid}-hi { color: var(--accent); }
    .${sid}-lbl { transform: translate(-50%, 0); text-align: center; font-family: var(--font-body); font-weight: 600; color: var(--muted); line-height: 1.12; overflow-wrap: break-word; }
    #${sid}-cap { position: absolute; left: ${box.x}px; top: ${rect.y + rect.h + 14}px; width: ${box.w}px; text-align: center; font-family: var(--font-mono); font-size: var(--fs-label); color: var(--muted); letter-spacing: 0.04em; line-height: 1.25; }
  `;

  // Timing (seconds, scene-local): bars grow in sequence after the title lands.
  const s0 = ctx.isFirst ? 0.2 : 0.45;
  const grow = Math.max(0.7, Math.min(1.3, ctx.motion.dur * 1.8));
  const stagger = Math.min(0.32, Math.max(0.12, (ctx.durationS * 0.42 - grow) / Math.max(1, n - 1)));

  if (t.html) anim.enter(`#${sid}-title`, ctx.isFirst ? 0 : 0.1, { from: "up", dist: 30 });
  d.items.forEach((_, i) => anim.fadeIn(`#${sid}-l${i}`, s0 + i * stagger, 0.3));
  if (d.caption) anim.fadeIn(`#${sid}-cap`, s0 + n * stagger + 0.2, 0.4);

  const three = `${prelude(ctx, rect, { fov: 30 })}
      var ITEMS = ${js(d.items.map((it) => ({ v: it.value, hi: !!it.highlight })))}, FIN = ${js(finals)}, PRE = ${js(pre)}, POST = ${js(post)}, DEC = ${decimals};
      var N = ITEMS.length, P = 1.0, BW = 0.62, HM = ${r3(n <= 3 ? 3.2 : n <= 5 ? 3.6 : 3.9)};
      var MAX = Math.max.apply(null, ITEMS.map(function (i) { return i.v; })) || 1;
      var S0 = ${r3(s0)}, G = ${r3(grow)}, ST = ${r3(stagger)};
      var ground = new T.Mesh(new T.PlaneGeometry(N * P + 1.6, 3.2), mat(PAL.surface)); ground.rotation.x = -Math.PI / 2; S.add(ground);
      var gl = []; for (var k = 0; k <= N; k++) { var x0 = (k - N / 2) * P; gl.push(x0, 0.002, -1.2, x0, 0.002, 1.2); }
      var gg = new T.BufferGeometry(); gg.setAttribute("position", new T.Float32BufferAttribute(gl, 3));
      S.add(new T.LineSegments(gg, new T.LineBasicMaterial({ color: new T.Color(PAL.line) })));
      var bars = ITEMS.map(function (it, i) {
        var g = new T.BoxGeometry(BW, 1, BW); g.translate(0, 0.5, 0);
        var col = ${anyHi} ? (it.hi ? PAL.accent : PAL.muted) : PAL.accent;
        var m = new T.Mesh(g, mat(col, { emissive: new T.Color(col), emissiveIntensity: it.hi ? 0.22 : 0.08 }));
        m.position.x = (i - (N - 1) / 2) * P; edge(m, PAL.ink); S.add(m);
        return { m: m, h: Math.max(0.04, HM * it.v / MAX) };
      });
      function fmt(v) { return PRE + v.toLocaleString("en-US", { minimumFractionDigits: DEC, maximumFractionDigits: DEC }) + POST; }
      var halfW = (N * P) / 2 / ${r3(box.w / ctx.width)} + 0.1, halfH = HM * 0.56 + 0.4;
      var D0 = fitCam(C, halfW, halfH);
      var vals = ITEMS.map(function (_, i) { return document.getElementById(${js(`${sid}-v`)} + i); });
      function update(t) {
        var u = EIO(t / DUR);
        var az = lerp(-0.3, 0.12, u), el = lerp(0.3, 0.22, u), dist = D0 * lerp(1.1, 1.0, E3(t / Math.min(DUR, 3)));
        var cy = HM * 0.5;
        C.position.set(Math.sin(az) * Math.cos(el) * dist, cy + Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
        C.lookAt(0, cy, 0); C.updateMatrixWorld();
        bars.forEach(function (b, i) {
          var e = E3(seg(t, S0 + i * ST, G));
          b.m.scale.y = Math.max(0.001, b.h * e); b.m.visible = e > 0.001;
          var top = proj(b.m.position.x, b.h * e + 0.1, 0);
          tag(${js(`${sid}-vw`)} + i, top[0], top[1], seg(t, S0 + i * ST + 0.08, 0.2));
          var base = proj(b.m.position.x, 0, BW / 2 + 0.28);
          tag(${js(`${sid}-lw`)} + i, base[0], base[1] + 6);
          if (vals[i]) vals[i].textContent = e >= 1 ? FIN[i] : fmt(Math.round(ITEMS[i].v * e * Math.pow(10, DEC)) / Math.pow(10, DEC));
        });
      }${driver(ctx)}`;

  anim.raw(guard(three));
  return { html, css, timeline: anim.out() };
};
