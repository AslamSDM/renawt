import type { Composition, ScenePlan } from "@remawt/shared";
import { KEN_BURNS_MAX } from "./blocks/media";
import { planTextIssues, type TextIssue } from "./textfit";

export interface LintResult { ok: boolean; errors: string[]; warnings: string[] }

/** GSAP properties the kit (and the legacy composer contract) allows on DOM targets. */
export const ALLOWED_PROPS = new Set([
  "opacity", "x", "y", "scale", "scaleX", "scaleY", "rotation", "color", "backgroundColor", "clipPath", "letterSpacing", "filter",
  // hand-drawn (sketch) skins draw SVG strokes on with a dash offset
  "strokeDashoffset",
]);
/** Tween control keys (not animated properties). */
const CONTROL_KEYS = new Set([
  "duration", "ease", "stagger", "delay", "transformOrigin", "svgOrigin", "repeat", "yoyo", "repeatDelay", "immediateRender", "overwrite", "onUpdate", "onComplete", "onStart", "id", "paused", "force3D",
]);
const FORBIDDEN_PROPS = new Set(["display", "visibility", "autoAlpha", "width", "height", "left", "top", "right", "bottom", "margin", "padding"]);

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

/** Find balanced `{...}` object literals following `tl.<method>(` and return [method, args[]] entries. */
function tweenCalls(js: string): Array<{ method: string; target: string; objs: string[]; at: number }> {
  const out: Array<{ method: string; target: string; objs: string[]; at: number }> = [];
  const re = /\b(?:tl|gsap|[A-Za-z_$][\w$]*)\.(to|from|fromTo|set)\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(js))) {
    let i = m.index + m[0].length, depth = 1;
    const start = i;
    let str: string | null = null;
    while (i < js.length && depth > 0) {
      const c = js[i];
      if (str) { if (c === "\\") i++; else if (c === str) str = null; }
      else if (c === '"' || c === "'" || c === "`") str = c;
      else if (c === "(" || c === "{" || c === "[") depth++;
      else if (c === ")" || c === "}" || c === "]") depth--;
      i++;
    }
    const args = js.slice(start, i - 1);
    const objs: string[] = [];
    let d = 0, s = -1; str = null;
    for (let k = 0; k < args.length; k++) {
      const c = args[k];
      if (str) { if (c === "\\") k++; else if (c === str) str = null; continue; }
      if (c === '"' || c === "'" || c === "`") { str = c; continue; }
      if (c === "{") { if (d === 0) s = k; d++; }
      else if (c === "}") { d--; if (d === 0 && s >= 0) { objs.push(args.slice(s, k + 1)); s = -1; } }
    }
    const target = args.match(/^\s*("[^"]*"|'[^']*'|[^,]+)/)?.[1] ?? "";
    out.push({ method: m[1], target, objs, at: m.index });
  }
  return out;
}

function topKeys(obj: string): Array<{ key: string; value: string }> {
  const body = obj.slice(1, -1);
  const out: Array<{ key: string; value: string }> = [];
  let d = 0, str: string | null = null, cur = "";
  const parts: string[] = [];
  for (const c of body) {
    if (str) { cur += c; if (c === str) str = null; continue; }
    if (c === '"' || c === "'" || c === "`") { str = c; cur += c; continue; }
    if (c === "{" || c === "[" || c === "(") d++;
    if (c === "}" || c === "]" || c === ")") d--;
    if (c === "," && d === 0) { parts.push(cur); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur);
  for (const p of parts) {
    const mm = p.match(/^\s*["']?([\w$-]+)["']?\s*:\s*([\s\S]*)$/);
    if (mm) out.push({ key: mm[1], value: mm[2].trim() });
  }
  return out;
}

function scripts(html: string): string {
  return [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
}

function styles(html: string): string {
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
}

function ids(html: string): string[] {
  return [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
}

/** Checks shared by index and scene files. */
function lintScript(where: string, html: string, errors: string[], warnings: string[]): void {
  const js = scripts(html);
  if (/Date\.now\(|new Date\(|performance\.now\(/.test(js)) errors.push(`${where}: wall-clock time (Date/performance) is not allowed`);
  if (/Math\.random\(/.test(js)) errors.push(`${where}: unseeded Math.random() is not allowed`);
  if (/\bfetch\(|XMLHttpRequest|import\(/.test(js)) errors.push(`${where}: network fetches are not allowed`);
  if (/\bset(?:Timeout|Interval)\(|requestAnimationFrame\(/.test(js)) errors.push(`${where}: timers / rAF are not allowed`);
  if (/repeat\s*:\s*-1/.test(js)) errors.push(`${where}: repeat: -1 is not allowed`);
  if (/\.(?:play|pause|seek)\(\s*\)/.test(js) || /\.currentTime\s*=/.test(js)) errors.push(`${where}: never play()/pause()/seek timelines or media`);
  if (/DOMContentLoaded|addEventListener\(\s*["']load/.test(js)) errors.push(`${where}: timelines must be built synchronously (no DOMContentLoaded/load handlers)`);
  if (/\.add\(\s*window\.__timelines/.test(js)) errors.push(`${where}: never add() a scene timeline into another timeline (the runtime drives each scene)`);

  for (const call of tweenCalls(js)) {
    const { method, objs, target } = call;
    if (method === "fromTo" && objs.slice(0, 2).some((o) => topKeys(o).some((k) => k.key === "opacity" || k.key === "autoAlpha"))) {
      errors.push(`${where}: fromTo() with opacity on ${target} (set opacity first, then .to())`);
    }
    for (const o of objs.slice(0, method === "fromTo" ? 2 : 1)) {
      for (const { key, value } of topKeys(o)) {
        if (FORBIDDEN_PROPS.has(key)) {
          if (method === "set" && key === "visibility") continue;
          errors.push(`${where}: ${method}() animates forbidden property "${key}" on ${target}`);
        } else if (!ALLOWED_PROPS.has(key) && !CONTROL_KEYS.has(key)) {
          warnings.push(`${where}: ${method}() uses non-contract property "${key}" on ${target}`);
        }
        if (key === "repeat" && value.trim() === "-1") errors.push(`${where}: repeat: -1 on ${target}`);
      }
    }
  }
}

/**
 * Static contract checks for a composed project. Mirrors the HyperFrames render contract
 * (root attrs, hosts, templates, timeline registration, determinism, forbidden tweens)
 * plus kit rules (id prefixes, durations sum, no root backgrounds, assets resolvable).
 */
export function lintComposition(comp: Composition): LintResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const idx = comp.indexHtml ?? "";
  const fps = comp.fps || 30;
  const frame = 1 / fps;

  // ---- root
  const rootTag = idx.match(/<div\b[^>]*\bid="root"[^>]*>/)?.[0];
  let rootDur = NaN;
  if (!rootTag) errors.push(`index.html: missing <div id="root">`);
  else {
    if (attr(rootTag, "data-composition-id") !== "main") errors.push(`index.html: root data-composition-id must be "main"`);
    for (const a of ["data-start", "data-duration", "data-width", "data-height"]) if (attr(rootTag, a) === undefined) errors.push(`index.html: root is missing ${a}`);
    rootDur = Number(attr(rootTag, "data-duration"));
    if (Number(attr(rootTag, "data-width")) !== comp.width || Number(attr(rootTag, "data-height")) !== comp.height) errors.push(`index.html: root size ${attr(rootTag, "data-width")}x${attr(rootTag, "data-height")} ≠ composition ${comp.width}x${comp.height}`);
    if (Math.abs(rootDur - comp.durationMs / 1000) > frame) errors.push(`index.html: root data-duration ${rootDur}s ≠ composition durationMs ${comp.durationMs}`);
  }
  if (!/<script\s+src="[^"]*gsap[^"]*"/.test(idx)) errors.push(`index.html: GSAP <script src> missing`);
  if (!/window\.__timelines\[\s*["']main["']\s*\]\s*=/.test(idx)) errors.push(`index.html: window.__timelines["main"] is not registered`);
  if (/<template\b/.test(idx)) errors.push(`index.html: standalone root must not be wrapped in <template>`);
  lintScript("index.html", idx, errors, warnings);

  // ---- hosts
  const files = new Map(comp.sceneFiles.map((f) => [`compositions/${f.fileName}`, f]));
  const hostTags = [...idx.matchAll(/<div\b[^>]*\bdata-composition-src="[^"]*"[^>]*>/g)].map((m) => m[0]);
  const hosts = hostTags.map((tag) => ({
    tag, id: attr(tag, "id"), cid: attr(tag, "data-composition-id"), src: attr(tag, "data-composition-src") ?? "",
    start: Number(attr(tag, "data-start")), dur: Number(attr(tag, "data-duration")), kind: attr(tag, "data-track-kind"), layer: attr(tag, "data-remawt-layer"),
  }));
  for (const h of hosts) {
    const w = `host ${h.id ?? h.src}`;
    for (const a of ["data-composition-id", "data-start", "data-duration", "data-width", "data-height", "data-track-index"]) if (attr(h.tag, a) === undefined) errors.push(`${w}: missing ${a}`);
    if (h.id !== h.cid) errors.push(`${w}: host id "${h.id}" must equal data-composition-id "${h.cid}"`);
    if (!files.has(h.src)) errors.push(`${w}: data-composition-src "${h.src}" not found in sceneFiles`);
    if (/opacity\s*:\s*0/.test(attr(h.tag, "style") ?? "")) errors.push(`${w}: scene hosts must not be hidden with inline opacity`);
    if (Number.isFinite(rootDur) && h.start + h.dur > rootDur + frame) errors.push(`${w}: ends at ${h.start + h.dur}s, past root duration ${rootDur}s`);
  }
  const scenes = hosts.filter((h) => !h.layer && h.kind !== "captions").sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const s of scenes) {
    if (Math.abs(s.start - cursor) > frame) errors.push(`host ${s.id}: starts at ${s.start}s, expected ${Math.round(cursor * 1000) / 1000}s (scenes must be back to back)`);
    cursor = s.start + s.dur;
  }
  const sum = scenes.reduce((a, s) => a + s.dur, 0);
  if (scenes.length && Number.isFinite(rootDur) && Math.abs(sum - rootDur) > frame * Math.max(1, scenes.length / 2)) errors.push(`index.html: scene durations sum to ${Math.round(sum * 1000) / 1000}s but root is ${rootDur}s`);
  if (!scenes.length) errors.push(`index.html: no scene hosts`);

  // ---- media in root
  for (const m of idx.matchAll(/<(audio|video)\b([^>]*)>/g)) {
    const tag = m[0];
    const id = attr(tag, "id");
    if (!id) errors.push(`index.html: <${m[1]}> without id is left out of the mix`);
    if (/\scrossorigin/.test(tag)) errors.push(`index.html: <${m[1]} id="${id}"> must not set crossorigin`);
    if (m[1] === "video" && !/\smuted/.test(tag) && attr(tag, "data-has-audio") !== "true") errors.push(`index.html: <video id="${id}"> needs muted or data-has-audio="true"`);
    const st = Number(attr(tag, "data-start") ?? 0), du = Number(attr(tag, "data-duration") ?? 0);
    if (Number.isFinite(rootDur) && st + du > rootDur + frame) errors.push(`index.html: <${m[1]} id="${id}"> ends past the root duration`);
    const auto = tag.match(/data-automation='([^']*)'/)?.[1];
    if (auto) { try { JSON.parse(auto); } catch { errors.push(`index.html: <${m[1]} id="${id}"> data-automation is not valid JSON`); } }
  }

  // ---- media manifest (video-segment footage)
  const media = readMediaManifest(idx, errors);

  // ---- scene files
  const allIds = new Map<string, string>();
  for (const id of ids(idx)) allIds.set(id, "index.html");
  for (const f of comp.sceneFiles) {
    const w = `compositions/${f.fileName}`;
    const html = f.html.trim();
    if (!html.startsWith("<template>") || !html.endsWith("</template>")) errors.push(`${w}: scene file must be wrapped in <template>…</template>`);
    const root = html.match(/<div\b[^>]*\bid="root"[^>]*>/)?.[0];
    if (!root) errors.push(`${w}: missing <div id="root">`);
    else {
      if (attr(root, "data-composition-id") !== f.id) errors.push(`${w}: root data-composition-id "${attr(root, "data-composition-id")}" ≠ scene id "${f.id}"`);
      if (attr(root, "data-width") === undefined || attr(root, "data-height") === undefined) errors.push(`${w}: root needs data-width/data-height`);
      if (/background/.test(attr(root, "style") ?? "")) errors.push(`${w}: no background on the scene root (put fills on an absolute child)`);
      if (attr(root, "class")) warnings.push(`${w}: style the scene root as #root, not by class`);
    }
    const css = styles(html);
    for (const m of css.matchAll(/#root\s*\{([^}]*)\}/g)) if (/(^|;|\s)background(-color|-image)?\s*:/.test(m[1])) errors.push(`${w}: no background on the scene root (#root)`);
    if (/@import/.test(css)) warnings.push(`${w}: @import inside a scene file`);
    if (/<audio\b/.test(html)) errors.push(`${w}: <audio> belongs in index.html, not inside a scene`);
    lintSceneVideos(w, f.id, html, hosts.find((h) => h.cid === f.id)?.dur, media, frame, errors);
    if (/<br\s*\/?>/i.test(html)) warnings.push(`${w}: <br> in text; use block spans`);
    if (/\scrossorigin/.test(html)) errors.push(`${w}: crossorigin attribute breaks preview`);
    const js = scripts(html);
    const reg = new RegExp(`window\\.__timelines\\[\\s*["']${f.id.replace(/[-]/g, "\\-")}["']\\s*\\]\\s*=`);
    const regAt = js.search(reg);
    if (regAt < 0) errors.push(`${w}: window.__timelines["${f.id}"] is not registered`);
    else {
      const lastTween = Math.max(...tweenCalls(js).map((c) => c.at), -1);
      if (lastTween > regAt) errors.push(`${w}: timeline registered before its tweens`);
    }
    if (!/gsap\.timeline\(\s*\{\s*paused\s*:\s*true\s*\}\s*\)/.test(js)) errors.push(`${w}: timeline must be gsap.timeline({ paused: true })`);
    lintScript(w, html, errors, warnings);

    // ids: prefixed, unique across the assembled page
    for (const id of ids(html)) {
      if (id === "root") continue;
      if (!id.startsWith(`${f.id}-`)) errors.push(`${w}: element id "${id}" must be prefixed with "${f.id}-"`);
      const prev = allIds.get(id);
      if (prev) errors.push(`${w}: duplicate id "${id}" (also in ${prev})`);
      allIds.set(id, w);
    }

    // no CSS transform on elements GSAP transforms
    const transformed = new Set<string>();
    for (const c of tweenCalls(js)) {
      const sel = c.target.replace(/^["']|["']$/g, "");
      if (!/^#[\w-]+$/.test(sel)) continue;
      if (c.objs.slice(0, 2).some((o) => topKeys(o).some((k) => ["x", "y", "scale", "scaleX", "scaleY", "rotation"].includes(k.key)))) transformed.add(sel.slice(1));
      if (/-kb$/.test(sel)) for (const o of c.objs) for (const k of topKeys(o)) if (k.key === "scale" && Number(k.value) > KEN_BURNS_MAX + 1e-6) errors.push(`${w}: Ken Burns scale ${k.value} exceeds ${KEN_BURNS_MAX}`);
    }
    for (const m of css.matchAll(/#([\w-]+)\s*\{([^}]*)\}/g)) if (transformed.has(m[1]) && /(^|;|\s)transform\s*:/.test(m[2])) errors.push(`${w}: #${m[1]} has a CSS transform and is also transformed by GSAP`);
    for (const m of html.matchAll(/<[^>]+\sid="([^"]+)"[^>]*\sstyle="([^"]*)"/g)) if (transformed.has(m[1]) && /transform\s*:/.test(m[2])) errors.push(`${w}: #${m[1]} has an inline transform and is also transformed by GSAP`);

    // assets: absolute https / data: only (the kit ships no local asset files)
    for (const m of html.matchAll(/\s(?:src|href)="([^"]+)"/g)) checkUrl(w, m[1], errors, warnings);
    for (const m of css.replace(/url\(\s*"data:[^"]*"\s*\)|url\(\s*'data:[^']*'\s*\)/g, "").matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) checkUrl(w, m[1], errors, warnings);
  }
  for (const m of idx.matchAll(/<(?:audio|video|img)\b[^>]*\ssrc="([^"]+)"/g)) checkUrl("index.html", m[1], errors, warnings);
  const referenced = new Set(hosts.map((h) => h.src));
  for (const f of comp.sceneFiles) if (!referenced.has(`compositions/${f.fileName}`)) warnings.push(`compositions/${f.fileName}: not mounted by any host`);

  lintTextFit(comp, errors);
  lintThree(comp, hosts.map((h) => ({ cid: h.cid, dur: h.dur })), errors, warnings);
  return { ok: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

interface MediaEntry { scene: string; assetId: string; url: string; inMs: number; outMs: number; slotMs?: number }

function readMediaManifest(idx: string, errors: string[]): MediaEntry[] | null {
  const m = idx.match(/<script type="application\/json" id="remawt-media">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const v = JSON.parse(m[1]) as { videos?: MediaEntry[] };
    for (const e of v.videos ?? []) {
      if (!(e.inMs >= 0)) errors.push(`media ${e.assetId}: inMs must be ≥ 0`);
      if (!(e.outMs > e.inMs)) errors.push(`media ${e.assetId}: outMs (${e.outMs}) must be > inMs (${e.inMs})`);
      if (!e.url) errors.push(`media ${e.assetId}: missing url`);
    }
    return v.videos ?? [];
  } catch {
    errors.push(`index.html: #remawt-media manifest is not valid JSON`);
    return [];
  }
}

/** <video> inside a scene: timed on the element, trimmed, muted or data-has-audio, listed in the media manifest, range-consistent. */
function lintSceneVideos(w: string, sceneId: string, html: string, slotS: number | undefined, media: MediaEntry[] | null, frame: number, errors: string[]): void {
  for (const m of html.matchAll(/<video\b[^>]*>/g)) {
    const tag = m[0];
    const id = attr(tag, "id") ?? "?";
    const src = (attr(tag, "src") ?? "").replace(/&amp;/g, "&");
    if (!/\bclass="[^"]*\bclip\b/.test(tag)) errors.push(`${w}: <video id="${id}"> needs class="clip"`);
    for (const a of ["data-start", "data-duration", "data-media-start"]) if (attr(tag, a) === undefined) errors.push(`${w}: <video id="${id}"> missing ${a}`);
    if (!/\smuted(\s|>|=)/.test(tag) && attr(tag, "data-has-audio") !== "true") errors.push(`${w}: <video id="${id}"> needs muted or data-has-audio="true"`);
    if (/\scrossorigin/.test(tag)) errors.push(`${w}: <video id="${id}"> must not set crossorigin`);
    const st = Number(attr(tag, "data-start") ?? 0), du = Number(attr(tag, "data-duration") ?? 0), ms = Number(attr(tag, "data-media-start") ?? 0);
    if (ms < 0) errors.push(`${w}: <video id="${id}"> data-media-start < 0`);
    if (slotS !== undefined && st + du > slotS + frame) errors.push(`${w}: <video id="${id}"> runs past its scene slot (${st + du}s > ${slotS}s)`);
    const entry = media?.find((e) => e.scene === sceneId && e.url === src);
    if (!entry) { errors.push(`${w}: <video id="${id}"> source is not listed in the #remawt-media manifest`); continue; }
    if (Math.abs(ms - entry.inMs / 1000) > 0.002) errors.push(`${w}: <video id="${id}"> data-media-start ${ms}s ≠ manifest inMs ${entry.inMs}`);
    if (du > (entry.outMs - entry.inMs) / 1000 + frame) errors.push(`${w}: <video id="${id}"> plays ${du}s but the range [${entry.inMs}, ${entry.outMs}] is only ${(entry.outMs - entry.inMs) / 1000}s`);
  }
}

function checkUrl(where: string, url: string, errors: string[], warnings: string[]): void {
  if (/^(https:|data:|#)/.test(url)) return;
  if (/^http:/.test(url)) { warnings.push(`${where}: insecure http asset ${url}`); return; }
  if (/^(file:|\/)/.test(url)) { errors.push(`${where}: local path "${url}" will not exist on the renderer; upload to R2 and use its https URL`); return; }
  if (/^assets\//.test(url)) { warnings.push(`${where}: "${url}" must be shipped in projectFiles`); return; }
  errors.push(`${where}: unresolvable asset reference "${url}"`);
}

/**
 * Text that a block had to cut with "…" to keep it inside its box (blocks/common.ts fitHtml marks it
 * data-fit="truncated"). Overflow itself cannot happen (text is fitted); a cut label is still a defect.
 */
function lintTextFit(comp: Composition, errors: string[]): void {
  for (const f of comp.sceneFiles) {
    for (const m of f.html.matchAll(/<[^>]*\sdata-fit="truncated"[^>]*>/g)) {
      const tag = m[0];
      const text = (attr(tag, "data-fit-text") ?? "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
      const role = attr(tag, "data-fit-role") ?? "text";
      const max = attr(tag, "data-fit-max");
      errors.push(`compositions/${f.fileName}: ${role} "${text}" (${text.length} chars) does not fit its box and was cut with "…"${max ? `; shorten it to ≤ ${max} chars` : ""} [scene ${f.id}]`);
    }
  }
}

/**
 * Measure-based text checks on a ScenePlan, before composing: every label longer than its block's
 * documented budget, or estimated (same estimator + fitter as the blocks) to be cut in its box.
 * `issues` have the PlanIssue shape ({sceneId, index, block, path, message}) the engine's repair loop
 * (repairScene) takes; `errors` are the same as strings.
 */
export function lintPlanText(plan: ScenePlan): LintResult & { issues: TextIssue[] } {
  const issues = planTextIssues(plan);
  return { ok: issues.length === 0, errors: issues.map((i) => `${i.path}: ${i.message}`), warnings: [], issues };
}

// ───────────────────────── 3D blocks (Three.js / WebGL) ─────────────────────────

/** Max WebGL scenes per video: Chrome keeps ~16 live contexts per page; past that the oldest are lost. */
export const MAX_3D_SCENES = 8;
/** Planner budget: more than this many 3D scenes in one short is a warning (render time, novelty). */
export const WARN_3D_SCENES = 3;
const THREE_LABEL_MAX: Record<string, number> = { "chart-3d": 16, "globe-3d": 24, "stat-3d": 18, "scene-3d": 20 };
const THREE_MIN_S = 1.5, THREE_MAX_S = 12;

/**
 * Checks for scenes that render a Three.js canvas (marked with data-remawt-3d): the runtime <script> is in
 * index.html and pinned, scene count stays under the WebGL context budget, object counts / label lengths /
 * motion timing stay in bounds, and the canvas has a fixed pixel size.
 */
function lintThree(comp: Composition, hosts: Array<{ cid?: string; dur: number }>, errors: string[], warnings: string[]): void {
  let n = 0;
  for (const f of comp.sceneFiles) {
    for (const m of f.html.matchAll(/<canvas\b[^>]*\sdata-remawt-3d="([^"]*)"[^>]*>/g)) {
      n++;
      const w = `compositions/${f.fileName}`;
      const tag = m[0];
      if (!/\swidth="\d+"/.test(tag) || !/\sheight="\d+"/.test(tag)) errors.push(`${w}: 3D canvas needs fixed width/height attributes`);
      let meta: { block?: string; objects?: number; labels?: string[]; motionsEndMs?: number; durationMs?: number };
      try { meta = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")); } catch { errors.push(`${w}: data-remawt-3d is not valid JSON`); continue; }
      const block = meta.block ?? "3d";
      if ((meta.objects ?? 0) > 8) errors.push(`${w}: ${block} has ${meta.objects} objects (max 8)`);
      if ((meta.objects ?? 0) < 1) errors.push(`${w}: ${block} has no objects`);
      const max = THREE_LABEL_MAX[block] ?? 24;
      for (const l of meta.labels ?? []) if (String(l).length > max) errors.push(`${w}: ${block} label "${l}" is longer than ${max} chars`);
      const slot = hosts.find((h) => h.cid === f.id)?.dur ?? (meta.durationMs ?? 0) / 1000;
      if (slot && slot < THREE_MIN_S) warnings.push(`${w}: ${block} scene is ${slot}s; 3D needs at least ${THREE_MIN_S}s to read`);
      if (slot > THREE_MAX_S) warnings.push(`${w}: ${block} scene is ${slot}s; keep 3D scenes under ${THREE_MAX_S}s`);
      if (meta.motionsEndMs && slot && meta.motionsEndMs > slot * 1000 + 1) warnings.push(`${w}: ${block} motions end at ${meta.motionsEndMs}ms, after the ${Math.round(slot * 1000)}ms scene (they will be cut)`);
      if (!/addEventListener\(\s*"hf-seek"/.test(f.html)) errors.push(`${w}: 3D scene must render from the hf-seek event`);
    }
  }
  if (!n) return;
  const tag = comp.indexHtml.match(/<script\s+src="([^"]*\/three@[^"]*)"/);
  if (!tag) errors.push(`index.html: ${n} 3D scene(s) but no Three.js <script src>`);
  else if (!/three@\d+\.\d+\.\d+\//.test(tag[1])) errors.push(`index.html: Three.js URL must pin an exact version (${tag[1]})`);
  if (n > MAX_3D_SCENES) errors.push(`index.html: ${n} 3D scenes (max ${MAX_3D_SCENES}: WebGL context limit)`);
  else if (n > WARN_3D_SCENES) warnings.push(`index.html: ${n} 3D scenes; more than ${WARN_3D_SCENES} slows the render and dulls the effect`);
}
