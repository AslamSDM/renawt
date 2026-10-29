import type { z } from "zod";
import type { BlockFn } from "../types";
import type { Globe3DData } from "./schema";
import { titleCss, titleHtml } from "../common";
import { WORLD_COUNTRIES, WORLD_VIEWBOX } from "../world.data";
import { esc, fitFontSize, js, r3 } from "../../util";
import { canvasCss, canvasHtml, driver, guard, prelude, type Rect } from "./runtime";

type D = z.infer<typeof Globe3DData>;

let OUTLINES: number[][] | null = null;
/**
 * Country outlines from world.data.ts (equirectangular px) → polylines of [lng, lat] in tenths of a degree,
 * decimated to ≥ 0.6° steps. Computed once; ~25 KB of JSON per globe scene.
 */
export function worldOutlines(): number[][] {
  if (OUTLINES) return OUTLINES;
  const { w, h, north, south } = WORLD_VIEWBOX;
  const out: number[][] = [];
  for (const c of WORLD_COUNTRIES) {
    for (const ring of c.d.split(/(?=M)/)) {
      const nums = ring.replace(/[MLZ]/gi, " ").trim().split(/[\s,]+/).map(Number).filter((v) => Number.isFinite(v));
      const line: number[] = [];
      let px = NaN, py = NaN;
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const lng = (nums[i] / w) * 360 - 180, lat = north - (nums[i + 1] / h) * (north - south);
        const last = i + 3 >= nums.length;
        if (!last && Number.isFinite(px) && Math.hypot(lng - px, lat - py) < 0.6) continue;
        px = lng; py = lat;
        line.push(Math.round(lng * 10), Math.round(lat * 10));
      }
      if (line.length >= 6) { line.push(line[0], line[1]); out.push(line); }
    }
  }
  OUTLINES = out;
  return out;
}

/** Great-circle angle between two places (radians). */
function arcAngle(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const v = (p: { lat: number; lng: number }) => [Math.cos(p.lat * r) * Math.sin(p.lng * r), Math.sin(p.lat * r), Math.cos(p.lat * r) * Math.cos(p.lng * r)];
  const A = v(a), B = v(b);
  return Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])));
}

/**
 * Rotating globe (graticule + country outlines) that flies to `focus` and drops a pin with a label; with
 * `from`, both pins drop and a great-circle arc draws from origin to focus.
 */
export const globe3d: BlockFn<D> = (ctx) => {
  const { sid, box, anim } = ctx;
  const d = ctx.data;
  const t = titleHtml(ctx, d.title ?? ctx.headline);
  const rect: Rect = { x: 0, y: box.y + t.h, w: ctx.width, h: Math.max(420, box.h - t.h) };
  const lblSize = (s: string) => fitFontSize(s, { maxWidth: box.w * 0.6, base: 46, min: 26 });
  const fromLabel = d.from?.label;
  const tags = `
        <div id="${sid}-fw" class="${sid}-tag"><div id="${sid}-fl" class="${sid}-pill ${sid}-pill-main" style="font-size:${lblSize(d.focus.label)}px">${esc(d.focus.label)}</div></div>
        ${d.from && fromLabel ? `<div id="${sid}-ow" class="${sid}-tag"><div id="${sid}-ol" class="${sid}-pill" style="font-size:${lblSize(fromLabel) - 6}px">${esc(fromLabel)}</div></div>` : ""}`;
  const meta = { block: "globe-3d", objects: d.from ? 2 : 1, labels: [d.focus.label, ...(fromLabel ? [fromLabel] : [])], durationMs: Math.round(ctx.durationS * 1000) };
  const html = `
      ${t.html}
      ${canvasHtml(sid, rect, meta, tags)}`;
  const css = `
    ${titleCss(ctx)}
    ${canvasCss(sid, rect)}
    .${sid}-pill { transform: translate(-50%, calc(-100% - 26px)); white-space: nowrap; font-family: var(--font-display); font-weight: 800; color: var(--ink); background: color-mix(in srgb, var(--bg) 82%, transparent); border: 3px solid var(--line); border-radius: var(--r-pill); padding: 10px 24px; line-height: 1.05; }
    .${sid}-pill-main { border-color: var(--accent); }
    #${sid}-ol { transform: translate(-50%, 34px); }
    #${sid}-gl { -webkit-mask-image: linear-gradient(to bottom, #000 0, #000 84%, transparent 100%); mask-image: linear-gradient(to bottom, #000 0, #000 84%, transparent 100%); }
  `;

  // Timeline (s): fly, then pins + arc. Everything below is a pure function of t.
  const fly0 = ctx.isFirst ? 0.1 : 0.3;
  const fly = Math.max(1.2, Math.min(2.6, ctx.durationS * 0.42));
  // Order: origin pin → arc → focus pin (without an origin, the focus pin drops when the fly lands).
  const pinFrom = fly0 + fly - 0.15;
  const arc0 = pinFrom + 0.25, arcD = d.from ? Math.max(0.8, Math.min(1.6, ctx.durationS * 0.25)) : 0;
  const pin1 = d.from ? arc0 + arcD - 0.1 : pinFrom;
  const pin2 = pinFrom;
  const span = d.from ? arcAngle(d.from, d.focus) : 0;
  const mid = d.from ? midpoint(d.from, d.focus) : { lat: d.focus.lat, lng: d.focus.lng };
  const zoom = d.from ? Math.min(4.3, 2.9 + span * 1.3) : 2.75;

  if (t.html) anim.enter(`#${sid}-title`, ctx.isFirst ? 0 : 0.1, { from: "up", dist: 30 });
  anim.fadeIn(`#${sid}-gl`, ctx.isFirst ? 0 : 0.05, 0.45);

  const three = `${prelude(ctx, rect, { fov: 34 })}
      var OUT = ${js(worldOutlines())};
      var FOC = ${js({ lat: d.focus.lat, lng: d.focus.lng })}, FROM = ${js(d.from ? { lat: d.from.lat, lng: d.from.lng } : null)}, MID = ${js(mid)};
      var FLY0 = ${r3(fly0)}, FLY = ${r3(fly)}, PIN1 = ${r3(pin1)}, ARC0 = ${r3(arc0)}, ARCD = ${r3(arcD)}, PIN2 = ${r3(pin2)}, ZOOM = ${r3(zoom)};
      var RAD = Math.PI / 180;
      function onS(lat, lng, r) { var a = lat * RAD, b = lng * RAD; return new T.Vector3(Math.cos(a) * Math.sin(b) * r, Math.sin(a) * r, Math.cos(a) * Math.cos(b) * r); }
      var tilt = new T.Group(), spin = new T.Group(); tilt.add(spin); S.add(tilt);
      var globeCol = HAND ? PAL.surface : new T.Color(PAL.surface).lerp(new T.Color(PAL.accent), 0.16).getHex();
      var ball = new T.Mesh(new T.SphereGeometry(1, 64, 48), mat(globeCol)); spin.add(ball);
      var gp = [];
      for (var la = -75; la <= 75; la += 15) for (var lo = -180; lo < 180; lo += 4) { var p = onS(la, lo, 1.002), q = onS(la, lo + 4, 1.002); gp.push(p.x, p.y, p.z, q.x, q.y, q.z); }
      for (var lo2 = -180; lo2 < 180; lo2 += 15) for (var la2 = -88; la2 < 88; la2 += 4) { var p2 = onS(la2, lo2, 1.002), q2 = onS(la2 + 4, lo2, 1.002); gp.push(p2.x, p2.y, p2.z, q2.x, q2.y, q2.z); }
      var gg = new T.BufferGeometry(); gg.setAttribute("position", new T.Float32BufferAttribute(gp, 3));
      spin.add(new T.LineSegments(gg, new T.LineBasicMaterial({ color: new T.Color(PAL.line) })));
      var cp = [];
      OUT.forEach(function (l) { for (var i = 0; i + 3 < l.length; i += 2) { var a = onS(l[i + 1] / 10, l[i] / 10, 1.004), b = onS(l[i + 3] / 10, l[i + 2] / 10, 1.004); cp.push(a.x, a.y, a.z, b.x, b.y, b.z); } });
      var cg = new T.BufferGeometry(); cg.setAttribute("position", new T.Float32BufferAttribute(cp, 3));
      spin.add(new T.LineSegments(cg, new T.LineBasicMaterial({ color: new T.Color(HAND ? PAL.ink : PAL.muted) })));
      function pin(pl, hex) {
        var g = new T.Group(), n = onS(pl.lat, pl.lng, 1);
        var stick = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.16, 8), mat(hex)); stick.position.y = 0.08;
        var head = new T.Mesh(new T.SphereGeometry(0.036, 20, 14), mat(hex, { emissive: new T.Color(hex), emissiveIntensity: 0.5 })); head.position.y = 0.17;
        var ring = new T.Mesh(new T.RingGeometry(0.03, 0.045, 40), new T.MeshBasicMaterial({ color: new T.Color(hex), transparent: true, side: T.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.004;
        g.add(stick); g.add(head); g.add(ring);
        g.position.copy(n); g.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), n.clone().normalize());
        spin.add(g); return { g: g, ring: ring, n: n };
      }
      var P1 = pin(FOC, PAL.accent), P2 = FROM ? pin(FROM, PAL.accent2) : null;
      var arc = null, ARCN = 0;
      if (FROM) {
        var A = onS(FROM.lat, FROM.lng, 1), B = onS(FOC.lat, FOC.lng, 1), ang = A.angleTo(B), pts = [];
        for (var k = 0; k <= 64; k++) { var u = k / 64; var v = A.clone().multiplyScalar(Math.sin((1 - u) * ang)).add(B.clone().multiplyScalar(Math.sin(u * ang))).divideScalar(Math.sin(ang) || 1); v.normalize().multiplyScalar(1.005 + Math.sin(Math.PI * u) * Math.min(0.45, 0.12 + ang * 0.22)); pts.push(v); }
        var tube = new T.TubeGeometry(new T.CatmullRomCurve3(pts), 96, 0.011, 8, false);
        ARCN = tube.index.count;
        arc = new T.Mesh(tube, new T.MeshBasicMaterial({ color: new T.Color(PAL.accent2) })); spin.add(arc);
      }
      var tgt = FROM ? MID : FOC;
      var startLng = tgt.lng - 95, startLat = tgt.lat * 0.3;
      var _w = new T.Vector3();
      function update(t) {
        var u = EIO(seg(t, FLY0, FLY));
        var lng = lerp(startLng, tgt.lng, u) + 2.2 * Math.max(0, t - FLY0 - FLY), lat = lerp(startLat, tgt.lat, u);
        tilt.rotation.x = lat * RAD; spin.rotation.y = -lng * RAD;
        var dist = lerp(4.3, ZOOM, EIO(seg(t, FLY0 + FLY * 0.25, FLY * 0.9)));
        C.position.set(0, 0, dist); C.lookAt(0, 0, 0); C.updateMatrixWorld(); S.updateMatrixWorld(true);
        [[P1, PIN1, ${js(`${sid}-fw`)}], [P2, PIN2, ${js(`${sid}-ow`)}]].forEach(function (r) {
          var p = r[0]; if (!p) return;
          var e = EB(seg(t, r[1], 0.45)); p.g.scale.setScalar(Math.max(0.001, e)); p.g.visible = e > 0.001;
          var ph = (t - r[1]) % 1.1, pu = t >= r[1] ? ph / 1.1 : 0;
          p.ring.scale.setScalar(1 + 2.6 * pu); p.ring.material.opacity = t >= r[1] ? 0.9 * (1 - pu) : 0;
          p.g.localToWorld(_w.set(0, 0.2, 0)); var s = proj(_w.x, _w.y, _w.z);
          var facing = p.n.clone().applyMatrix4(spin.matrixWorld).z;
          tag(r[2], s[0], s[1], seg(t, r[1] + 0.15, 0.3) * (facing > 0.1 ? 1 : 0));
        });
        if (arc) arc.geometry.setDrawRange(0, Math.floor(ARCN * E3(seg(t, ARC0, ARCD)) / 3) * 3);
      }${driver(ctx)}`;

  anim.raw(guard(three));
  return { html, css, timeline: anim.out() };
};

function midpoint(a: { lat: number; lng: number }, b: { lat: number; lng: number }): { lat: number; lng: number } {
  const r = Math.PI / 180;
  const v = (p: { lat: number; lng: number }) => [Math.cos(p.lat * r) * Math.sin(p.lng * r), Math.sin(p.lat * r), Math.cos(p.lat * r) * Math.cos(p.lng * r)];
  const A = v(a), B = v(b);
  const m = [A[0] + B[0], A[1] + B[1], A[2] + B[2]];
  const len = Math.hypot(m[0], m[1], m[2]) || 1;
  return { lat: r3(Math.asin(m[1] / len) / r), lng: r3(Math.atan2(m[0], m[2]) / r) };
}
