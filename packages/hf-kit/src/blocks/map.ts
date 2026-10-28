import type { z } from "zod";
import type { BlockFn } from "./types";
import type { MapData } from "./schema";
import { titleCss, titleHtml } from "./common";
import { WORLD_COUNTRIES, WORLD_VIEWBOX } from "./world.data";
import { esc, r1 } from "../util";

type D = z.infer<typeof MapData>;

const { w: VW, h: VH, north: N, south: S } = WORLD_VIEWBOX;
const px = (lon: number) => ((lon + 180) / 360) * VW;
const py = (lat: number) => ((N - Math.max(S, Math.min(N, lat))) / (N - S)) * VH;

/** lon/lat bounds per focus: [west, east, north, south]. */
const FOCUS: Record<D["focus"], [number, number, number, number]> = {
  world: [-180, 180, N, S],
  europe: [-25, 45, 72, 34],
  asia: [25, 150, 60, -10],
  africa: [-20, 55, 38, -36],
  "north-america": [-170, -50, 75, 7],
  "south-america": [-85, -32, 14, -56],
  americas: [-170, -30, 75, -56],
  oceania: [110, 180, 0, -48],
  "middle-east": [25, 65, 42, 12],
};

const CONTINENT_ALIAS: Record<string, D["focus"]> = {
  europe: "europe", asia: "asia", africa: "africa", "north america": "north-america", "south america": "south-america",
  "latin america": "south-america", americas: "americas", oceania: "oceania", australia: "oceania", "middle east": "middle-east",
};

const NAME_ALIAS: Record<string, string> = {
  usa: "United States of America", us: "United States of America", "united states": "United States of America", america: "United States of America",
  uk: "United Kingdom", britain: "United Kingdom", "great britain": "United Kingdom", england: "United Kingdom",
  uae: "United Arab Emirates", "south korea": "South Korea", korea: "South Korea", "north korea": "North Korea",
  "czech republic": "Czechia", "ivory coast": "Côte d'Ivoire", drc: "Dem. Rep. Congo", "dr congo": "Dem. Rep. Congo",
  "democratic republic of the congo": "Dem. Rep. Congo", "bosnia": "Bosnia and Herz.", "dominican republic": "Dominican Rep.",
  "central african republic": "Central African Rep.", "south sudan": "S. Sudan", "eswatini": "eSwatini", swaziland: "eSwatini",
  "north macedonia": "Macedonia", holland: "Netherlands", "the netherlands": "Netherlands", burma: "Myanmar", "east timor": "Timor-Leste",
  "western sahara": "W. Sahara", "equatorial guinea": "Eq. Guinea", "solomon islands": "Solomon Is.", russia: "Russia",
};

const byName = new Map(WORLD_COUNTRIES.map((c, i) => [c.name.toLowerCase(), i]));

/** Resolve region names to country indices (countries, aliases, or whole continents). */
export function resolveRegions(regions: D["regions"]): { idx: number[]; labels: Array<{ i: number; text: string }>; unknown: string[] } {
  const idx: number[] = [];
  const labels: Array<{ i: number; text: string }> = [];
  const unknown: string[] = [];
  for (const r of regions) {
    const name = typeof r === "string" ? r : r.name;
    const label = typeof r === "string" ? undefined : r.label;
    const key = name.trim().toLowerCase();
    const cont = CONTINENT_ALIAS[key];
    if (cont) {
      const [w, e, n, s] = FOCUS[cont];
      WORLD_COUNTRIES.forEach((c, i) => {
        if (c.c[0] >= px(w) && c.c[0] <= px(e) && c.c[1] >= py(n) && c.c[1] <= py(s)) idx.push(i);
      });
      continue;
    }
    const i = byName.get((NAME_ALIAS[key] ?? name).toLowerCase()) ?? byName.get(key);
    if (i === undefined) { unknown.push(name); continue; }
    idx.push(i);
    labels.push({ i, text: label ?? WORLD_COUNTRIES[i].name.replace("United States of America", "USA") });
  }
  return { idx: [...new Set(idx)], labels, unknown };
}

/** World / region outline, highlighted countries fade to accent in sequence, labelled points pulse. */
export const map: BlockFn<D> = (ctx) => {
  const { sid, box, anim } = ctx;
  const d = ctx.data;
  const t = titleHtml(ctx, ctx.headline);
  const [w, e, n, s] = FOCUS[d.focus];
  const vb = { x: px(w), y: py(n), w: px(e) - px(w), h: py(s) - py(n) };
  const labelH = d.label ? 90 : 0;
  const availH = box.h - t.h - labelH;
  let mw = box.w, mh = (box.w * vb.h) / vb.w;
  if (mh > availH) { mh = availH; mw = (availH * vb.w) / vb.h; }
  const mx = box.x + (box.w - mw) / 2, my = box.y + t.h + (availH - mh) / 2;
  const k = mw / vb.w;
  const toPx = (x: number, y: number) => [r1((x - vb.x) * k), r1((y - vb.y) * k)] as const;

  const { idx, labels } = resolveRegions(d.regions);
  const inView = (c: (typeof WORLD_COUNTRIES)[number]) => c.c[0] >= vb.x - 80 && c.c[0] <= vb.x + vb.w + 80 && c.c[1] >= vb.y - 60 && c.c[1] <= vb.y + vb.h + 60;
  const basePaths = WORLD_COUNTRIES.filter((c) => d.focus === "world" || inView(c)).map((c) => `<path d="${c.d}"/>`).join("");
  const hiPaths = idx.map((i, j) => `<path id="${sid}-h${j}" d="${WORLD_COUNTRIES[i].d}"/>`).join("");
  const stroke = r1(1.2 / k * 1.6);

  const showLabels = labels.length <= 5 ? labels : [];
  const lbls = showLabels.map((l, j) => {
    const [x, y] = toPx(...WORLD_COUNTRIES[l.i].c);
    return `<div id="${sid}-l${j}" class="${sid}-ml" style="left:${x}px;top:${y}px">${esc(l.text)}</div>`;
  }).join("");
  const pts = d.points.map((p, j) => {
    const [x, y] = toPx(px(p.lon), py(p.lat));
    return `<div class="${sid}-pt" style="left:${x}px;top:${y}px"><span id="${sid}-pr${j}" class="${sid}-ring"></span><span id="${sid}-p${j}" class="${sid}-dot"></span>${p.label ? `<span id="${sid}-pl${j}" class="${sid}-pl">${esc(p.label)}</span>` : ""}</div>`;
  }).join("");

  const html = `
      ${t.html}
      <div id="${sid}-map" class="${sid}-map">
        <svg width="${r1(mw)}" height="${r1(mh)}" viewBox="${r1(vb.x)} ${r1(vb.y)} ${r1(vb.w)} ${r1(vb.h)}" preserveAspectRatio="xMidYMid meet">
          <g class="${sid}-land" stroke-width="${stroke}">${basePaths}</g>
          <g class="${sid}-hi" stroke-width="${stroke}">${hiPaths}</g>
        </svg>
        ${lbls}
        ${pts}
      </div>
      ${d.label ? `<div id="${sid}-cap" class="${sid}-display ${sid}-mcap">${esc(d.label)}</div>` : ""}`;

  const css = `
    ${titleCss(ctx)}
    #${sid}-map { position: absolute; left: ${r1(mx)}px; top: ${r1(my)}px; width: ${r1(mw)}px; height: ${r1(mh)}px; }
    #${sid}-map svg { display: block; overflow: visible; }
    .${sid}-land path { fill: var(--surface); stroke: var(--line); }
    .${sid}-hi path { fill: var(--accent); stroke: var(--bg); }
    .${sid}-ml { position: absolute; transform: translate(-50%, -50%); background: var(--bg); border: 2px solid var(--accent); color: var(--ink); font-family: var(--font-mono); font-size: var(--fs-label); padding: 6px 12px; border-radius: var(--r-sm); white-space: nowrap; }
    .${sid}-pt { position: absolute; width: 0; height: 0; }
    .${sid}-dot { position: absolute; left: -14px; top: -14px; width: 28px; height: 28px; border-radius: 50%; background: var(--accent2); box-shadow: 0 0 0 6px var(--bg); }
    .${sid}-ring { position: absolute; left: -28px; top: -28px; width: 56px; height: 56px; border-radius: 50%; border: 4px solid var(--accent2); box-sizing: border-box; }
    .${sid}-pl { position: absolute; left: 30px; top: -24px; font-family: var(--font-display); font-weight: 800; font-size: 40px; white-space: nowrap; text-shadow: 0 2px 12px var(--bg); }
    .${sid}-mcap { position: absolute; left: ${box.x}px; top: ${box.y + box.h - labelH + 10}px; width: ${box.w}px; text-align: center; font-size: var(--fs-s); }
  `;

  if (t.html) anim.enter(`#${sid}-title`, ctx.isFirst ? 0 : 0.1, { from: "up", dist: 30 });
  anim.fadeIn(`#${sid}-map`, ctx.isFirst ? 0 : 0.1, 0.4);
  anim.fromTo(`#${sid}-map`, { scale: 1 }, { scale: 1.04, duration: ctx.durationS, ease: "none" }, 0);
  const hiStart = 0.6;
  const hiStep = idx.length ? Math.min(0.25, (ctx.durationS * 0.45) / idx.length) : 0;
  idx.forEach((_, j) => anim.fadeIn(`#${sid}-h${j}`, hiStart + j * hiStep, 0.35));
  showLabels.forEach((_, j) => anim.fadeIn(`#${sid}-l${j}`, hiStart + j * hiStep + 0.3, 0.3));
  const ptStart = hiStart + idx.length * hiStep + 0.2;
  d.points.forEach((p, j) => {
    const at = ptStart + j * 0.3;
    anim.enter(`#${sid}-p${j}`, at, { from: "scale", ease: "back.out(2.5)", dur: 0.4 });
    anim.set(`#${sid}-pr${j}`, { opacity: 0 }, 0);
    for (let c = 0; c < 2; c++) {
      const tc = at + 0.2 + c * 0.9;
      if (tc + 0.8 > ctx.durationS) break;
      anim.set(`#${sid}-pr${j}`, { opacity: 0.9, scale: 0.6 }, tc);
      anim.to(`#${sid}-pr${j}`, { opacity: 0, scale: 2.4, duration: 0.8, ease: "power2.out" }, tc);
    }
    if (p.label) anim.enter(`#${sid}-pl${j}`, at + 0.15, { from: "left", dist: 20 });
  });
  if (d.label) anim.enter(`#${sid}-cap`, Math.min(ptStart + 0.3, ctx.durationS * 0.6), { from: "up", dist: 24 });
  return { html, css, timeline: anim.out() };
};
