import type { z } from "zod";
import type { BlockFn } from "../types";
import type { Scene3DData } from "./schema";
import { titleCss, titleHtml } from "../common";
import { esc, fitFontSize, js, r3 } from "../../util";
import { canvasCss, canvasHtml, driver, guard, prelude, type Rect } from "./runtime";

type D = z.infer<typeof Scene3DData>;

/** Seconds at which each object first appears (explicit scale-in, else a staggered default entrance). */
export function scene3dTimings(d: D, durationS: number, isFirst: boolean, enterDur: number): Array<{ appear: number; dur: number; explicit: boolean }> {
  const base = isFirst ? 0.1 : 0.3;
  return d.objects.map((o, i) => {
    const si = o.motions.find((m) => m.type === "scale-in");
    if (si) return { appear: Math.min(si.startMs / 1000, durationS), dur: si.durationMs / 1000, explicit: true };
    return { appear: Math.min(base + i * 0.12, durationS * 0.5), dur: Math.max(0.35, enterDur), explicit: false };
  });
}

/**
 * Planner-described scene of primitives with colour roles and named motions. All motion is evaluated
 * from t each frame: position = base → path → orbit → bob; rotation = base + spin; scale = base × entrance × pulse.
 */
export const scene3d: BlockFn<D> = (ctx) => {
  const { sid, box, anim } = ctx;
  const d = ctx.data;
  const t = titleHtml(ctx, ctx.headline);
  const capH = d.caption ? 90 : 0;
  const rect: Rect = { x: 0, y: box.y + t.h, w: ctx.width, h: Math.max(360, box.h - t.h - capH) };
  const timings = scene3dTimings(d, ctx.durationS, ctx.isFirst, ctx.motion.dur * 1.4);
  const labelled = d.objects.filter((o) => o.label);
  const lblSize = labelled.length ? Math.min(...labelled.map((o) => fitFontSize(o.label!, { maxWidth: box.w * 0.42, base: 40, min: 26 }))) : 0;
  const tags = d.objects.map((o, i) => (o.label ? `<div id="${sid}-tw${i}" class="${sid}-tag"><div id="${sid}-t${i}" class="${sid}-olbl" style="font-size:${lblSize}px">${esc(o.label)}</div></div>` : "")).join("");
  const motionsEnd = Math.max(0, ...d.objects.flatMap((o) => o.motions.map((m) => m.startMs + m.durationMs)));
  const meta = { block: "scene-3d", objects: d.objects.length, labels: labelled.map((o) => o.label), motionsEndMs: motionsEnd, durationMs: Math.round(ctx.durationS * 1000) };
  const html = `
      ${t.html}
      ${canvasHtml(sid, rect, meta, tags)}
      ${d.caption ? `<div id="${sid}-cap" class="${sid}-cap">${esc(d.caption)}</div>` : ""}`;
  const css = `
    ${titleCss(ctx)}
    ${canvasCss(sid, rect)}
    .${sid}-olbl { transform: translate(-50%, -100%); white-space: nowrap; font-family: var(--font-display); font-weight: 800; color: var(--ink); text-shadow: 0 2px 12px var(--bg); line-height: 1; }
    #${sid}-cap { position: absolute; left: ${box.x}px; top: ${rect.y + rect.h + 14}px; width: ${box.w}px; text-align: center; font-size: var(--fs-small); color: var(--muted); line-height: 1.25; }
  `;
  if (t.html) anim.enter(`#${sid}-title`, ctx.isFirst ? 0 : 0.1, { from: "up", dist: 30 });
  if (d.caption) anim.enter(`#${sid}-cap`, Math.min(ctx.durationS * 0.5, 0.9), { from: "up", dist: 24 });

  const objs = d.objects.map((o, i) => ({
    s: o.shape, p: o.position, k: o.scale, r: (o.rotation ?? [0, 0, 0]).map((v) => r3((v * Math.PI) / 180)), c: o.color, lbl: !!o.label,
    a: r3(timings[i].appear), ad: r3(timings[i].dur),
    m: o.motions.filter((m) => m.type !== "scale-in").map((m) => ({ t: m.type, s: r3(m.startMs / 1000), d: r3(m.durationMs / 1000), ax: m.axis, n: m.turns, amt: m.amount, to: m.to, from: m.from })),
  }));

  // Frame the content, not the whole ±4 world: bounding radius of every position an object can reach.
  const reach = Math.max(1.4, ...d.objects.map((o) => {
    const pts = [o.position, ...o.motions.flatMap((m) => [m.to, m.from].filter((v): v is number[] => !!v))];
    const orbit = o.motions.some((m) => m.type === "orbit");
    const bob = Math.max(0, ...o.motions.filter((m) => m.type === "bob").map((m) => m.amount));
    const pulse = 1 + Math.max(0, ...o.motions.filter((m) => m.type === "pulse").map((m) => m.amount));
    const r = Math.max(...pts.map((p) => (orbit ? Math.hypot(p[0], p[1], p[2]) : Math.max(Math.abs(p[0]), Math.abs(p[1]) + bob, Math.abs(p[2]) * 0.6))));
    return r + o.scale * 0.6 * pulse;
  }));
  const three = `${prelude(ctx, rect, { fov: 35 })}
      var OBJ = ${js(objs)}, CAM = ${js(d.camera)}, FRAME = ${r3(box.w / ctx.width)}, REACH = ${r3(reach)};
      function geom(s) {
        switch (s) {
          case "box": return new T.BoxGeometry(1, 1, 1);
          case "torus": return new T.TorusGeometry(0.42, 0.16, 24, 72);
          case "cone": return new T.ConeGeometry(0.5, 1, 48);
          case "cylinder": return new T.CylinderGeometry(0.5, 0.5, 1, 48);
          case "plane": { var g = new T.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; }
          case "ring": { var r = new T.TorusGeometry(0.5, 0.02, 12, 120); r.rotateX(Math.PI / 2); return r; }
          default: return new T.SphereGeometry(0.5, 48, 32);
        }
      }
      var items = OBJ.map(function (o) {
        var col = PAL[o.c] || PAL.accent, node;
        var m = mat(col, { emissive: new T.Color(col), emissiveIntensity: o.c === "accent" || o.c === "accent2" ? 0.12 : 0.03, side: o.s === "plane" ? T.DoubleSide : T.FrontSide });
        if (o.s === "arrow") {
          node = new T.Group();
          var shaft = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.72, 24), m); shaft.rotation.z = -Math.PI / 2; shaft.position.x = -0.14; edge(shaft);
          var head = new T.Mesh(new T.ConeGeometry(0.16, 0.28, 32), m); head.rotation.z = -Math.PI / 2; head.position.x = 0.36; edge(head);
          node.add(shaft); node.add(head);
        } else { node = new T.Mesh(geom(o.s), m); edge(node); }
        S.add(node);
        return { o: o, n: node };
      });
      var _v = new T.Vector3(), _ax = { x: new T.Vector3(1, 0, 0), y: new T.Vector3(0, 1, 0), z: new T.Vector3(0, 0, 1) };
      function camAt(t) {
        var base = fitCam(C, REACH * 1.12 / FRAME, REACH * 1.15);
        var az = 0, el = 0.08;
        if (CAM === "three-quarter") { az = 0.62; el = 0.42; }
        else if (CAM === "top") { az = 0; el = 1.22; }
        else if (CAM === "orbit") { az = lerp(-0.55, 0.85, EIO(t / DUR)); el = 0.4; }
        var dist = base * (CAM === "top" ? 0.95 : 1.0) * lerp(1.06, 1.0, E3(t / Math.min(DUR, 2.5)));
        C.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
        C.lookAt(0, 0, 0); C.updateMatrixWorld();
      }
      function update(t) {
        camAt(t);
        items.forEach(function (it, i) {
          var o = it.o, n = it.n;
          var px = o.p[0], py = o.p[1], pz = o.p[2], rx = o.r[0], ry = o.r[1], rz = o.r[2], k = o.k;
          var enter = EIN(seg(t, o.a, o.ad)); k *= enter;
          o.m.forEach(function (m) {
            var u = seg(t, m.s, m.d);
            if (m.t === "path" && m.to) { var f = m.from || o.p, e = EIO(u); px = lerp(f[0], m.to[0], e); py = lerp(f[1], m.to[1], e); pz = lerp(f[2], m.to[2], e); }
          });
          o.m.forEach(function (m) {
            var u = seg(t, m.s, m.d);
            if (m.t === "orbit") { _v.set(px, py, pz).applyAxisAngle(_ax[m.ax], m.n * Math.PI * 2 * u); px = _v.x; py = _v.y; pz = _v.z; }
            else if (m.t === "spin") { var a = m.n * Math.PI * 2 * u; if (m.ax === "x") rx += a; else if (m.ax === "z") rz += a; else ry += a; }
            else if (m.t === "bob") { var cyc = Math.max(1, Math.round(m.d / 1.2)); py += m.amt * Math.sin(Math.PI * 2 * cyc * u); }
            else if (m.t === "pulse") { var cyp = Math.max(1, Math.round(m.d / 0.8)); k *= 1 + m.amt * Math.abs(Math.sin(Math.PI * cyp * u)); }
          });
          n.position.set(px, py, pz); n.rotation.set(rx, ry, rz); n.scale.setScalar(Math.max(0.001, k)); n.visible = enter > 0.001;
          if (o.lbl) { var s = proj(px, py + 0.5 * k + 0.22, pz); tag(${js(`${sid}-tw`)} + i, s[0], s[1], seg(t, o.a + o.ad * 0.5, 0.25)); }
        });
      }${driver(ctx)}`;

  anim.raw(guard(three));
  return { html, css, timeline: anim.out() };
};
