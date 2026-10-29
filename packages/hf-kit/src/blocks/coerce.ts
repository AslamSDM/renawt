/**
 * Lenient coercion of LLM-written block data onto the strict block schemas in ./schema.ts.
 *
 * The strict schemas are the renderer contract. LLMs get the shape slightly wrong in predictable ways
 * (bare strings where an object is expected, "$4,000" for a number, a series given as a bare number
 * array, synonyms for keys, too-long text). `coerceData` walks the strict zod schema and repairs those
 * shapes; per-block `PRE` steps fix the structural mismatches the generic walker cannot see (diagram
 * node ids/edges, chart series, split-stat rounds, counter display strings).
 *
 * Nothing here imports values from ./schema.ts (it receives the schema as an argument), so schema.ts
 * can build its lenient wrappers from it without an import cycle.
 */
import { z } from "zod";

export interface CoerceChange { path: string; note: string }
/** Scene context available to plan-level coercion (not to the bare zod preprocess). */
export interface CoerceCtx { headline?: string; body?: string; ordinal?: number; total?: number }

type Obj = Record<string, unknown>;
type AnyZ = z.ZodType;
// zod v4 internals: every schema exposes `_zod.def` with a `type` tag.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const def = (s: AnyZ): any => (s as any)._zod.def;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const ok = (s: AnyZ, v: unknown) => s.safeParse(v).success;
const short = (v: unknown) => { const s = typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v) ?? String(v); return s.length > 40 ? `${s.slice(0, 37)}…` : s; };

/** Unwrap optional/default/nullable wrappers. */
export function unwrap(s: AnyZ): AnyZ {
  let cur = s;
  for (let i = 0; i < 6; i++) {
    const d = def(cur);
    if (d.type === "optional" || d.type === "default" || d.type === "nullable" || d.type === "prefault") cur = d.innerType;
    else if (d.type === "pipe") cur = d.out;
    else break;
  }
  return cur;
}
const typeOf = (s: AnyZ): string => def(unwrap(s)).type;

function lengthBounds(s: AnyZ): { min?: number; max?: number } {
  const out: { min?: number; max?: number } = {};
  for (const c of def(s).checks ?? []) {
    const cd = c._zod?.def ?? {};
    if (cd.check === "min_length") out.min = cd.minimum;
    if (cd.check === "max_length") out.max = cd.maximum;
  }
  return out;
}
function numBounds(s: AnyZ): { min?: number; max?: number; minExcl?: boolean; maxExcl?: boolean; int: boolean } {
  const out: { min?: number; max?: number; minExcl?: boolean; maxExcl?: boolean; int: boolean } = { int: false };
  for (const c of def(s).checks ?? []) {
    const cd = c._zod?.def ?? {};
    if (cd.check === "greater_than") { out.min = cd.value; out.minExcl = !cd.inclusive; }
    if (cd.check === "less_than") { out.max = cd.value; out.maxExcl = !cd.inclusive; }
    if (cd.check === "number_format" && /int/.test(String(cd.format))) out.int = true;
  }
  return out;
}

// ───────────────────────── scalars ─────────────────────────

const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9, t: 1e12, tn: 1e12, trillion: 1e12 };
const SUFFIX_SHORT: Record<string, string> = { thousand: "K", k: "K", million: "M", mn: "M", m: "M", billion: "B", bn: "B", b: "B", trillion: "T", tn: "T", t: "T", percent: "%", "%": "%", x: "x", "×": "×" };

export interface ParsedNumber { value: number; prefix: string; suffix: string; decimals: number; scaled: number }
/** "$4,000" → 4000 (prefix "$"); "39%" → 39 ("%"); "1.2M" → 1.2 ("M", scaled 1.2e6); "≈ 22 %" → 22. */
export function parseNumber(raw: string): ParsedNumber | null {
  const s = raw.trim().replace(/[−–]/g, "-");
  const m = s.match(/^([^\d+\-.]{0,6}?)\s*([+-]?(?:\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.\d+)?|[+-]?\.\d+)\s*(%|x|×|k|mn|m|bn|b|tn|t|thousand|million|billion|trillion|percent)?\b\s*(.{0,12})$/i)
    ?? s.match(/^([^\d+\-.]{0,6}?)\s*([+-]?(?:\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.\d+)?)\s*(%|×)()$/);
  if (!m) return null;
  const numStr = m[2].replace(/[,\s]/g, "");
  const value = Number(numStr);
  if (!Number.isFinite(value)) return null;
  const unit = (m[3] ?? "").toLowerCase();
  const decimals = Math.min(3, (numStr.split(".")[1] ?? "").length);
  const prefix = m[1].replace(/[~≈]|about|approx\.?/gi, "").trim();
  const suffix = unit ? SUFFIX_SHORT[unit] ?? unit : (m[4] ?? "").trim().slice(0, 8);
  return { value, prefix, suffix, decimals, scaled: unit && SCALE[unit] ? value * SCALE[unit] : value };
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") return parseNumber(v)?.scaled;
  if (isObj(v)) for (const k of ["value", "amount", "y", "n", "count"]) if (k in v) return toNumber(v[k]);
  return undefined;
}

/** Cut at a word boundary and add an ellipsis. */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  let cut = s.slice(0, Math.max(1, max - 1));
  const sp = cut.lastIndexOf(" ");
  if (sp >= max * 0.6) cut = cut.slice(0, sp);
  return `${cut.replace(/[\s,.;:–—-]+$/, "")}…`;
}

const textOf = (v: unknown): string | undefined => {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (isObj(v)) for (const k of ["text", "label", "name", "title", "value"]) if (typeof v[k] === "string" || typeof v[k] === "number") return String(v[k]);
  return undefined;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const ENUM_SYNONYMS: Record<string, string> = {
  flow: "vertical", linear: "vertical", steps: "vertical", stack: "vertical", column: "vertical", tree: "vertical", sequence: "vertical",
  row: "horizontal", sidebyside: "horizontal", timeline: "horizontal",
  radial: "hub", star: "hub", hubandspoke: "hub", spoke: "hub", mindmap: "hub",
  circle: "cycle", loop: "cycle", circular: "cycle", ring: "cycle",
  columns: "bar", bars: "bar", barchart: "bar", histogram: "bar", linechart: "line", trend: "line", areachart: "area",
  zoomin: "in", zoomout: "out", panleft: "left", panright: "right", static: "none",
  contain: "blur-pad", fit: "blur-pad", fill: "cover", crop: "cover",
  global: "world", us: "north-america", usa: "north-america", unitedstates: "north-america", na: "north-america", latinamerica: "south-america", eu: "europe", australia: "oceania", mena: "middle-east", gulf: "middle-east",
  centre: "center", middle: "center", leftaligned: "left",
};
function matchEnum(entries: string[], v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const n = norm(v);
  const exact = entries.find((e) => norm(e) === n);
  if (exact) return exact;
  const syn = ENUM_SYNONYMS[n];
  if (syn && entries.includes(syn)) return syn;
  return entries.find((e) => n.includes(norm(e)) && norm(e).length >= 2) ?? entries.find((e) => norm(e).includes(n) && n.length >= 3);
}

// ───────────────────────── key aliases ─────────────────────────

/** target key ← accepted synonyms. Applied only when the target is missing and the synonym is not itself a schema key. */
const KEY_ALIASES: Record<string, string[]> = {
  label: ["name", "title", "text", "caption"],
  text: ["label", "title", "name", "content", "bullet"],
  name: ["label", "title", "country", "region"],
  sub: ["subtitle", "description", "desc", "detail", "details", "note", "caption", "subtext"],
  metric: ["label", "name", "title", "stat", "category"],
  values: ["data", "points", "y", "ys", "numbers"],
  labels: ["x", "xLabels", "xlabels", "categories", "years", "xAxis"],
  quote: ["text", "claim", "statement", "finding", "body"],
  source: ["sourceName", "citation", "publisher", "attribution"],
  items: ["bullets", "points", "list", "steps", "tips", "entries", "tiles", "icons"],
  regions: ["countries", "highlight", "highlighted", "areas", "highlights"],
  points: ["markers", "cities", "pins", "locations"],
  rounds: ["stats", "comparisons", "metrics", "rows", "comparison"],
  emphasis: ["highlight", "accent", "emphasize", "accentWords", "highlights"],
  nodes: ["steps", "items", "boxes", "stages"],
  edges: ["links", "connections", "arrows"],
  value: ["number", "amount", "stat", "count", "target", "to"],
  n: ["number", "index", "step", "num", "rank"],
  truth: ["fact", "correction", "reality", "actually"],
  myth: ["claim", "belief", "misconception"],
  outlet: ["publication", "publisher", "source", "site", "newspaper"],
  cta: ["action", "callToAction", "call_to_action", "button"],
  annotations: ["notes", "callouts", "events"],
  title: ["heading"],
  caption: ["alt"],
  lat: ["latitude"],
  lon: ["lng", "long", "longitude"],
  date: ["published", "publishedAt", "year", "when"],
  url: ["link", "href"],
  icon: ["iconName", "lucide", "emoji"],
  decimals: ["precision", "dp"],
  type: ["chartType", "kind", "style"],
  higherIsBetter: ["higher_is_better", "higherBetter", "betterIfHigher"],
  question: ["prompt", "vsText"],
  kicker: ["eyebrow", "overline", "tag", "preTitle"],
  index: ["at", "x", "i", "point", "pointIndex"],
};

const ALIAS_SOURCES = new Set([...Object.values(KEY_ALIASES).flat(), "data", "sources", "leftValue", "rightValue", "a", "b", "start", "end", "in", "out", "startSec", "endSec", "fromMs", "toMs", "claim", "fact"]);

export function applyAliases(input: Obj, shapeKeys: Set<string>, path: string, changes: CoerceChange[]): Obj {
  const out: Obj = { ...input };
  for (const target of shapeKeys) {
    if (out[target] !== undefined && out[target] !== null) continue;
    for (const alias of KEY_ALIASES[target] ?? []) {
      if (shapeKeys.has(alias)) continue;
      const hit = Object.keys(out).find((k) => k === alias || k.toLowerCase() === alias.toLowerCase());
      if (hit !== undefined && out[hit] !== undefined && out[hit] !== null) {
        out[target] = out[hit];
        delete out[hit];
        changes.push({ path: `${path}.${target}`, note: `renamed "${hit}" → "${target}"` });
        break;
      }
    }
  }
  return out;
}

// ───────────────────────── generic walker ─────────────────────────

const WRAP_KEYS = ["label", "text", "name", "metric", "quote", "title", "myth", "value"];

/**
 * Coerce `value` toward `schema`. Never throws; returns the best effort (which may still fail validation).
 * `keepUnknown` keeps keys the object schema does not know (used for the top-level data object so engine
 * keys like `asset`/`cutIn` survive; nested objects are stripped).
 */
export function coerceValue(schema: AnyZ, value: unknown, path: string, changes: CoerceChange[], keepUnknown = false): unknown {
  const d = def(schema);
  switch (d.type) {
    case "optional":
    case "nullable":
    case "default":
    case "prefault": {
      if (value === null || value === undefined) {
        if (value === null) changes.push({ path, note: "null → omitted" });
        return undefined;
      }
      const v = coerceValue(d.innerType, value, path, changes, keepUnknown);
      if (!ok(d.innerType, v)) {
        changes.push({ path, note: `dropped invalid optional value ${short(value)}` });
        return undefined;
      }
      return v;
    }
    case "pipe":
      return coerceValue(d.in, value, path, changes, keepUnknown);
    case "string": {
      let v: unknown = value;
      if (typeof v !== "string") {
        const t = Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number") ? v.join(", ") : textOf(v);
        if (t === undefined) return value;
        changes.push({ path, note: `${short(value)} → string` });
        v = t;
      }
      let s = (v as string).replace(/\s+/g, " ").trim();
      const { max } = lengthBounds(schema);
      if (max !== undefined && s.length > max) {
        s = truncate(s, max);
        changes.push({ path, note: `truncated to ${max} chars` });
      }
      return s;
    }
    case "number": {
      let n = toNumber(value);
      if (n === undefined) return value;
      if (typeof value !== "number") changes.push({ path, note: `${short(value)} → ${n}` });
      const b = numBounds(schema);
      if (b.int && !Number.isInteger(n)) { n = Math.round(n); changes.push({ path, note: "rounded to integer" }); }
      if (b.min !== undefined && (n < b.min || (b.minExcl && n <= b.min))) { const c = b.minExcl ? (b.int ? b.min + 1 : b.min + 1e-6) : b.min; changes.push({ path, note: `clamped ${n} → ${c}` }); n = c; }
      if (b.max !== undefined && (n > b.max || (b.maxExcl && n >= b.max))) { const c = b.maxExcl ? (b.int ? b.max - 1 : b.max - 1e-6) : b.max; changes.push({ path, note: `clamped ${n} → ${c}` }); n = c; }
      return n;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      const s = String(value).toLowerCase().trim();
      const b = ["true", "yes", "1", "y", "higher"].includes(s) ? true : ["false", "no", "0", "n", "lower"].includes(s) ? false : undefined;
      if (b === undefined) return value;
      changes.push({ path, note: `${short(value)} → ${b}` });
      return b;
    }
    case "enum": {
      const entries = Object.values(d.entries as Record<string, string>);
      if (entries.includes(value as string)) return value;
      const m = matchEnum(entries, value);
      if (m) { changes.push({ path, note: `${short(value)} → "${m}"` }); return m; }
      return value;
    }
    case "literal":
      return value;
    case "union": {
      const opts: AnyZ[] = d.options;
      const prim = (o: AnyZ) => ["string", "number", "boolean", "enum", "literal"].includes(typeOf(o));
      // Primitives that already validate are kept; objects always go through coercion (aliases would otherwise be stripped silently).
      if (!isObj(value) && !Array.isArray(value) && opts.some((o) => ok(o, value))) return value;
      const ordered = isObj(value) ? [...opts.filter((o) => !prim(o)), ...opts.filter(prim)] : [...opts.filter(prim), ...opts.filter((o) => !prim(o))];
      for (const o of ordered) {
        const local: CoerceChange[] = [];
        const v = coerceValue(o, value, path, local, keepUnknown);
        if (ok(o, v)) { changes.push(...local); return v; }
      }
      return value;
    }
    case "array": {
      if (value === null || value === undefined) return value;
      const el: AnyZ = d.element;
      let arr: unknown[];
      if (Array.isArray(value)) arr = value;
      else if (typeof value === "string") {
        arr = typeOf(el) === "number" ? value.split(/[;\s]+|,(?!\d{3})/).filter(Boolean) : value.split(/\s*(?:\n|•|;|\|)\s*/).filter(Boolean);
        changes.push({ path, note: `string → array of ${arr.length}` });
      } else if (isObj(value) && typeOf(el) === "number" && Object.values(value).every((x) => toNumber(x) !== undefined)) {
        arr = Object.values(value);
        changes.push({ path, note: "object of numbers → array" });
      } else { arr = [value]; changes.push({ path, note: "wrapped single value in an array" }); }
      const { min, max } = lengthBounds(schema);
      if (max !== undefined && arr.length > max) { changes.push({ path, note: `kept first ${max} of ${arr.length} items` }); arr = arr.slice(0, max); }
      const out = arr.map((x, i) => coerceValue(el, x, `${path}[${i}]`, changes));
      const good = out.filter((x) => ok(el, x));
      if (good.length < out.length && good.length >= (min ?? 0) && good.length > 0) {
        changes.push({ path, note: `dropped ${out.length - good.length} invalid item(s)` });
        return good;
      }
      return out;
    }
    case "object": {
      let v: unknown = value;
      const shape = d.shape as Record<string, AnyZ>;
      const keys = new Set(Object.keys(shape));
      if (typeof v === "string" || typeof v === "number") {
        const wk = WRAP_KEYS.find((k) => keys.has(k) && ["string", "number"].includes(typeOf(shape[k])));
        if (!wk) return value;
        v = { [wk]: v };
        changes.push({ path, note: `${short(value)} → {${wk}}` });
      }
      if (!isObj(v)) return value;
      const src = applyAliases(v, keys, path, changes);
      const out: Obj = {};
      if (keepUnknown) for (const [k, x] of Object.entries(src)) if (!keys.has(k)) out[k] = x;
      for (const k of keys) {
        const r = coerceValue(shape[k], src[k], `${path}.${k}`, changes);
        if (r !== undefined) out[k] = r;
      }
      return out;
    }
    default:
      return value;
  }
}

// ───────────────────────── per-block structural fixes ─────────────────────────

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
const firstText = (o: Obj, keys: string[]) => { for (const k of keys) { const t = textOf(o[k]); if (t?.trim()) return t.trim(); } return undefined; };

type Pre = (d: Obj, ctx: CoerceCtx, ch: (note: string, at?: string) => void) => Obj;

/**
 * 1-node diagrams are deliberately NOT coerced into another block (kinetic-headline / card): the
 * node's icon + sub would be lost, the scene's block choice would silently change under the planner,
 * and a coercion here could not see the scene headline it would need. Instead the diagram block lays
 * a single node out centred and large (layout "single" in blocks/diagram.ts), and the planner
 * catalogue's text budget tells the model to use kinetic-headline for a lone idea.
 */
function preDiagram(d: Obj, _ctx: CoerceCtx, ch: (n: string, at?: string) => void): Obj {
  let nodes = d.nodes;
  if (typeof nodes === "string") { nodes = nodes.split(/\s*(?:→|->|=>|\n|;|,)\s*/).filter(Boolean); ch("nodes string split on arrows/commas", "nodes"); }
  if (!Array.isArray(nodes)) return d;
  const ids = new Set<string>();
  const list = nodes.map((raw, i) => {
    const n: Obj = isObj(raw) ? { ...raw } : { label: textOf(raw) ?? `Step ${i + 1}` };
    if (!isObj(raw)) ch(`${short(raw)} → {id,label}`, `nodes[${i}]`);
    const label = firstText(n, ["label", "text", "name", "title", "id"]) ?? `Step ${i + 1}`;
    if (n.label === undefined) { n.label = label; for (const k of ["text", "name", "title"]) delete n[k]; }
    let id = textOf(n.id)?.trim() || slug(label) || `n${i + 1}`;
    id = id.slice(0, 30);
    while (ids.has(id)) id = `${id.slice(0, 26)}-${i + 1}`;
    if (id !== n.id) { if (n.id !== undefined) ch(`id ${short(n.id)} → "${id}"`, `nodes[${i}].id`); else ch(`added id "${id}"`, `nodes[${i}].id`); }
    ids.add(id);
    n.id = id;
    return n;
  });
  const resolve = (ref: unknown): string | undefined => {
    if (typeof ref === "number") return list[ref]?.id as string | undefined ?? list[ref - 1]?.id as string | undefined;
    const t = textOf(ref)?.trim();
    if (!t) return undefined;
    if (ids.has(t)) return t;
    const lc = t.toLowerCase();
    return (list.find((n) => String(n.label).toLowerCase() === lc || slug(String(n.label)) === slug(t))?.id as string | undefined)
      ?? (/^\d+$/.test(t) ? (list[Number(t)]?.id as string | undefined ?? list[Number(t) - 1]?.id as string | undefined) : undefined);
  };
  let edges = d.edges ?? d.links ?? d.connections ?? d.arrows;
  if (typeof edges === "string") edges = edges.split(/\s*[\n;]\s*/).filter(Boolean);
  let outEdges: Obj[] | undefined;
  if (Array.isArray(edges)) {
    outEdges = [];
    edges.forEach((e, k) => {
      let from: unknown, to: unknown, label: unknown;
      if (typeof e === "string") {
        const m = e.match(/^(.+?)\s*(?:→|->|=>|—>|-->|\bto\b)\s*(.+?)(?:\s*[:(]\s*(.+?)\)?)?$/i);
        if (m) { from = m[1]; to = m[2]; label = m[3]; }
      } else if (Array.isArray(e)) { [from, to, label] = e; }
      else if (isObj(e)) { from = e.from ?? e.source ?? e.start ?? e.a; to = e.to ?? e.target ?? e.end ?? e.b; label = e.label ?? e.text; }
      const f = resolve(from), t = resolve(to);
      if (f && t && f !== t) outEdges!.push({ from: f, to: t, ...(label !== undefined && label !== null && textOf(label) ? { label } : {}) });
      else ch(`dropped edge ${short(e)} (unknown node)`, `edges[${k}]`);
      if (!isObj(e) && f && t) ch(`${short(e)} → {from,to}`, `edges[${k}]`);
    });
  } else if (edges === undefined && list.length >= 2) {
    const layout = matchEnum(["auto", "vertical", "horizontal", "cycle", "hub", "grid"], d.layout) ?? "auto";
    if (layout === "hub") outEdges = list.slice(1).map((n) => ({ from: list[0].id, to: n.id }));
    else if (layout !== "grid") {
      outEdges = list.slice(1).map((n, i) => ({ from: list[i].id, to: n.id }));
      if (layout === "cycle") outEdges.push({ from: list[list.length - 1].id, to: list[0].id });
    }
    if (outEdges) ch(`no edges given → chained ${outEdges.length} arrows (${layout})`, "edges");
  }
  const out: Obj = { ...d, nodes: list };
  for (const k of ["links", "connections", "arrows"]) delete out[k];
  if (outEdges) out.edges = outEdges;
  return out;
}

function seriesFromPoints(pts: unknown[]): { values: unknown[]; labels?: string[] } | null {
  if (!pts.length || !pts.every(isObj)) return null;
  const values = pts.map((p) => (p as Obj).y ?? (p as Obj).value ?? (p as Obj).v ?? (p as Obj).amount);
  if (values.some((v) => toNumber(v) === undefined)) return null;
  const lab = pts.map((p) => textOf((p as Obj).x ?? (p as Obj).label ?? (p as Obj).year ?? (p as Obj).date ?? (p as Obj).name));
  return { values, labels: lab.every((l) => l !== undefined) ? (lab as string[]) : undefined };
}

function preChart(d0: Obj, ctx: CoerceCtx, ch: (n: string, at?: string) => void): Obj {
  const d: Obj = { ...d0 };
  let labels: unknown = d.labels ?? d.x ?? d.categories ?? d.years ?? d.xLabels;
  const nameOf = (o: Obj, i: number) => firstText(o, ["name", "label", "title", "key"]) ?? (i === 0 && typeof d.name === "string" ? d.name : `Series ${i + 1}`);
  let series: unknown = d.series;
  const bareNums = (a: unknown) => Array.isArray(a) && a.length > 0 && a.every((x) => toNumber(x) !== undefined && !isObj(x));
  let autoLabels = false;
  if (typeof series === "string") { if (d.name === undefined) d.name = series; series = undefined; ch("series name string → series[0].name", "series"); }
  if (series === undefined || (Array.isArray(series) && !series.length && (d.values ?? d.data ?? d.points ?? d.y) !== undefined)) {
    const vals = d.values ?? d.data ?? d.points ?? d.y;
    if (bareNums(vals)) { series = [{ name: typeof d.name === "string" ? d.name : ctx.headline?.slice(0, 30) || "Series 1", values: vals }]; ch("top-level values → series[0]", "series"); }
    else if (Array.isArray(vals)) {
      const p = seriesFromPoints(vals);
      if (p) { series = [{ name: typeof d.name === "string" ? d.name : "Series 1", values: p.values }]; if (labels === undefined && p.labels) labels = p.labels; ch("top-level points → series[0] + labels", "series"); }
    }
    for (const k of ["values", "data", "points", "y"]) delete d[k];
  } else if (bareNums(series)) {
    series = [{ name: typeof d.name === "string" ? d.name : "Series 1", values: series }];
    autoLabels = true;
    ch("series was a bare number array → [{name, values}]", "series");
  } else if (isObj(series)) {
    const s = series as Obj;
    if (s.values !== undefined || s.data !== undefined || s.points !== undefined) { series = [s]; ch("series object → [series]", "series"); }
    else { series = Object.entries(s).map(([name, values]) => ({ name, values })); ch("series map {name: values} → array", "series"); }
  }
  if (Array.isArray(series)) {
    series = series.map((raw, i) => {
      if (bareNums(raw)) { ch("bare number array → {name, values}", `series[${i}]`); return { name: `Series ${i + 1}`, values: raw }; }
      if (!isObj(raw)) return raw;
      const s: Obj = { ...raw };
      if (s.name === undefined) { s.name = nameOf(s, i); for (const k of ["label", "title", "key"]) delete s[k]; ch(`added name "${s.name}"`, `series[${i}].name`); }
      let vals = s.values ?? s.data ?? s.points ?? s.y;
      if (Array.isArray(vals) && !bareNums(vals)) {
        const p = seriesFromPoints(vals);
        if (p) { vals = p.values; if (labels === undefined && p.labels) labels = p.labels; ch("points [{x,y}] → values + labels", `series[${i}].values`); }
      }
      if (Array.isArray(vals)) {
        const nums = vals.filter((v) => toNumber(v) !== undefined);
        if (nums.length < vals.length) ch(`dropped ${vals.length - nums.length} non-numeric value(s)`, `series[${i}].values`);
        vals = nums;
        if (d.unit === undefined) { const u = nums.map((v) => (typeof v === "string" ? parseNumber(v) : null)).find((p) => p && (p.prefix || p.suffix)); if (u) d.unit = (u.prefix || u.suffix).slice(0, 8); }
      }
      for (const k of ["data", "points", "y"]) delete s[k];
      s.values = vals;
      return s;
    });
  }
  const n = Array.isArray(series) ? Math.max(0, ...series.map((s) => (isObj(s) && Array.isArray(s.values) ? s.values.length : 0))) : 0;
  if (Array.isArray(labels)) {
    if (n && labels.length > n) { labels = labels.slice(0, n); ch(`labels trimmed to ${n}`, "labels"); }
  } else if (typeof labels === "string") { labels = labels.split(/\s*,\s*/); ch("labels string → array", "labels"); }
  else if (labels === undefined && autoLabels && n >= 2) { labels = Array.from({ length: n }, (_, i) => String(i + 1)); ch(`auto x labels 1..${n}`, "labels"); }
  for (const k of ["x", "categories", "years", "xLabels", "name"]) delete d[k];
  if (labels !== undefined) d.labels = labels;
  d.series = series;
  if (typeof d.unit === "string") {
    const u = d.unit.trim().toLowerCase();
    const map: Record<string, string> = { percent: "%", percentage: "%", dollars: "$", usd: "$", euros: "€", eur: "€", pounds: "£", gbp: "£", millions: "M", billions: "B", thousands: "K" };
    if (map[u]) { ch(`unit "${d.unit}" → "${map[u]}"`, "unit"); d.unit = map[u]; }
    else if (d.unit.length > 8) {
      const sym = d.unit.match(/^\s*([$€£¥%°]C?|ppm|°F|kWh|GW|TWh|km|kg|mph|years?|yrs?)\b/i)?.[1] ?? d.unit.match(/[$€£¥%]/)?.[0];
      ch(`unit "${short(d.unit)}" too long → ${sym ? `"${sym}"` : "dropped"}`, "unit");
      if (sym) d.unit = sym; else delete d.unit;
    }
  }
  const lab = Array.isArray(d.labels) ? (d.labels as unknown[]).map((l) => String(l)) : [];
  let ann = d.annotations;
  if (isObj(ann)) ann = [ann];
  if (Array.isArray(ann)) {
    d.annotations = ann.map((a, k) => {
      if (!isObj(a)) return typeof a === "string" ? { index: Math.max(0, n - 1), label: a } : a;
      const o: Obj = { ...a };
      let idx = o.index ?? o.at ?? o.x ?? o.i ?? o.point ?? o.pointIndex ?? o.label_index ?? o.year ?? o.date ?? o.xLabel;
      if (typeof idx === "number" && lab.includes(String(idx)) && (o.index === undefined || idx >= n)) idx = lab.indexOf(String(idx));
      if (typeof idx === "string" && lab.includes(idx)) idx = lab.indexOf(idx);
      else if (typeof idx === "string" && toNumber(idx) !== undefined && lab.includes(String(toNumber(idx)))) idx = lab.indexOf(String(toNumber(idx)));
      const ni = toNumber(idx);
      if (ni !== undefined && n) { const c = Math.max(0, Math.min(n - 1, Math.round(ni))); if (c !== ni) ch(`index ${short(idx)} → ${c}`, `annotations[${k}].index`); o.index = c; }
      for (const kk of ["at", "x", "i", "point", "pointIndex", "label_index", "year", "date", "xLabel"]) delete o[kk];
      if (o.label === undefined) o.label = o.text ?? o.note ?? o.title;
      return o;
    });
  }
  return d;
}

function sideOf(v: unknown): Obj | undefined {
  if (isObj(v)) return v;
  const t = textOf(v);
  return t ? { label: t } : undefined;
}
function splitVs(h?: string): [string, string] | null {
  const m = h?.match(/^(.+?)\s+(?:vs\.?|versus|or|v\.)\s+(.+?)[?!.]*$/i);
  return m ? [m[1].trim(), m[2].trim()] : null;
}

function preSplitTitle(d0: Obj, ctx: CoerceCtx, ch: (n: string, at?: string) => void): Obj {
  const d: Obj = { ...d0 };
  const vs = splitVs(ctx.headline);
  for (const [k, i] of [["left", 0], ["right", 1]] as const) {
    const alt = k === "left" ? d.a ?? d.optionA ?? d.x : d.b ?? d.optionB ?? d.y;
    if (d[k] === undefined && alt !== undefined) { d[k] = alt; ch(`side from alias`, k); }
    if (d[k] === undefined && vs) { d[k] = { label: vs[i] }; ch(`side from headline "${vs[i]}"`, k); }
  }
  for (const k of ["a", "b", "optionA", "optionB", "x", "y"]) delete d[k];
  return d;
}

function preSplitStat(d0: Obj, ctx: CoerceCtx, ch: (n: string, at?: string) => void): Obj {
  const d = preSplitTitle(d0, ctx, ch);
  const L = sideOf(d.left), R = sideOf(d.right);
  let rounds = d.rounds ?? d.stats ?? d.comparisons ?? d.metrics ?? d.rows ?? d.comparison;
  for (const k of ["stats", "comparisons", "metrics", "rows", "comparison"]) delete d[k];
  // {left:{label,value}, right:{label,value}} with no rounds → one round.
  if (rounds === undefined) {
    const lv = L?.value ?? d.leftValue, rv = R?.value ?? d.rightValue;
    if (lv !== undefined && rv !== undefined) {
      rounds = [{ metric: d.metric ?? d.label ?? ctx.headline ?? "Result", left: lv, right: rv, ...(d.unit !== undefined ? { unit: d.unit } : {}), ...(d.higherIsBetter !== undefined ? { higherIsBetter: d.higherIsBetter } : {}) }];
      ch("left.value/right.value → rounds[0]", "rounds");
      for (const k of ["metric", "leftValue", "rightValue", "unit", "higherIsBetter", "label"]) delete d[k];
    }
  }
  if (isObj(rounds)) rounds = [rounds];
  if (Array.isArray(rounds)) {
    d.rounds = rounds.map((r, k) => {
      if (typeof r === "string") {
        const m = r.match(/^(.+?)\s*[:\-–]\s*(.+?)\s+(?:vs\.?|versus|v\.?)\s+(.+)$/i);
        if (m) { ch(`parsed "${short(r)}"`, `rounds[${k}]`); r = { metric: m[1], left: m[2], right: m[3] }; } else return r;
      }
      if (!isObj(r)) return r;
      const o: Obj = { ...r };
      if (o.metric === undefined) o.metric = o.label ?? o.name ?? o.title ?? o.stat ?? o.category;
      let unit = o.unit;
      for (const side of ["left", "right"] as const) {
        let v = o[side] ?? (side === "left" ? o.leftValue ?? o.a : o.rightValue ?? o.b);
        if (isObj(v)) v = v.value ?? v.amount ?? v.n;
        if (typeof v === "string") {
          const p = parseNumber(v);
          if (p) {
            if (unit === undefined && (p.prefix || p.suffix)) unit = (p.prefix || p.suffix).slice(0, 8);
            ch(`${short(v)} → ${p.scaled}`, `rounds[${k}].${side}`);
            v = p.scaled;
          }
        }
        o[side] = v;
      }
      for (const kk of ["leftValue", "rightValue", "a", "b", "label", "name", "title", "stat", "category"]) delete o[kk];
      if (unit !== undefined) o.unit = unit;
      if (typeof o.higherIsBetter === "string") o.higherIsBetter = /high|more|true|yes|up/i.test(o.higherIsBetter);
      if (o.higherIsBetter === undefined && typeof o.better === "string") o.higherIsBetter = /high|more|max|up/i.test(o.better);
      if (o.higherIsBetter === undefined && typeof o.winner === "string" && typeof o.left === "number" && typeof o.right === "number") {
        const lw = /left|a\b/i.test(o.winner) || (L && textOf(L.label) && String(o.winner).toLowerCase().includes(String(textOf(L.label)).toLowerCase()));
        o.higherIsBetter = lw ? o.left >= o.right : o.right >= o.left;
      }
      delete o.better; delete o.winner;
      return o;
    });
  }
  if (L && "value" in L) { const { value: _v, ...rest } = L; d.left = rest; }
  if (R && "value" in R) { const { value: _v, ...rest } = R; d.right = rest; }
  return d;
}

function preCounter(d0: Obj, ctx: CoerceCtx, ch: (n: string, at?: string) => void): Obj {
  const d: Obj = { ...d0 };
  let v = d.value ?? d.number ?? d.amount ?? d.stat ?? d.count ?? d.target ?? d.to;
  for (const k of ["number", "amount", "stat", "count", "target", "to"]) delete d[k];
  if (v === undefined) {
    const p = parseNumber(ctx.headline?.match(/[$€£]?\s?\d[\d,.]*\s?(?:%|[kmb]n?|million|billion)?/i)?.[0] ?? "");
    if (p) { v = ctx.headline!.match(/[$€£]?\s?\d[\d,.]*\s?(?:%|[kmb]n?|million|billion)?/i)![0]; ch(`value taken from headline "${v}"`, "value"); }
  }
  if (typeof v === "string") {
    const p = parseNumber(v);
    if (p) {
      ch(`${short(v)} → value ${p.value}${p.prefix ? `, prefix "${p.prefix}"` : ""}${p.suffix ? `, suffix "${p.suffix}"` : ""}`, "value");
      v = p.value;
      if (d.prefix === undefined && p.prefix) d.prefix = p.prefix.slice(0, 4);
      if (d.suffix === undefined && p.suffix) d.suffix = p.suffix.slice(0, 8);
      if (d.decimals === undefined && p.decimals) d.decimals = p.decimals;
    }
  }
  if (typeof v === "number" && d.decimals === undefined && !Number.isInteger(v)) {
    d.decimals = Math.min(3, (String(v).split(".")[1] ?? "").length);
    ch(`decimals ${d.decimals} inferred from ${v}`, "decimals");
  }
  if (typeof d.from === "string") { const p = parseNumber(d.from); if (p) d.from = p.value; }
  if (typeof d.suffix === "string") { const s = d.suffix.trim().toLowerCase(); const m = SUFFIX_SHORT[s]; if (m && d.suffix !== m) { ch(`suffix "${d.suffix}" → "${m}"`, "suffix"); d.suffix = m; } }
  if (typeof d.prefix === "string" && d.prefix.length > 4) { const m = d.prefix.match(/[$€£¥₹]/); if (m) { ch(`prefix "${d.prefix}" → "${m[0]}"`, "prefix"); d.prefix = m[0]; } }
  if (v !== undefined) d.value = v;
  return d;
}

function preNumbered(d0: Obj, ctx: CoerceCtx, ch: (n: string, at?: string) => void): Obj {
  const d: Obj = { ...d0 };
  let n = d.n ?? d.number ?? d.index ?? d.step ?? d.num ?? d.rank;
  for (const k of ["number", "index", "step", "num", "rank"]) delete d[k];
  if (typeof n === "string") n = toNumber(n.replace(/^\D+/, ""));
  if ((typeof n !== "number" || n < 1) && ctx.ordinal) { ch(`n missing/invalid → ${ctx.ordinal} (position)`, "n"); n = ctx.ordinal; }
  if (n !== undefined) d.n = n;
  if (typeof d.total === "string") d.total = toNumber(d.total);
  if (d.total === undefined && ctx.total && ctx.total > 1) d.total = ctx.total;
  if (typeof d.total === "number" && typeof d.n === "number" && d.total < d.n) { ch(`total ${d.total} < n → dropped`, "total"); delete d.total; }
  return d;
}

function preSourceCard(d0: Obj, ctx: CoerceCtx, ch: (n: string, at?: string) => void): Obj {
  const d: Obj = { ...d0 };
  let src = d.source ?? d.sourceName ?? d.citation ?? d.publisher ?? d.attribution;
  if (src === undefined && Array.isArray(d.sources) && d.sources.length) { src = d.sources[0]; ch("source ← sources[0]", "source"); }
  if (isObj(src)) {
    const s = src as Obj;
    if (d.url === undefined && typeof (s.url ?? s.link) === "string") d.url = s.url ?? s.link;
    if (d.date === undefined && (s.date ?? s.year) !== undefined) d.date = String(s.date ?? s.year);
    src = firstText(s, ["title", "name", "label", "outlet", "publisher"]);
    ch("source object → source + url", "source");
  }
  if (src !== undefined) d.source = src;
  for (const k of ["sources", "sourceName", "citation", "publisher", "attribution"]) delete d[k];
  if (d.quote === undefined && d.text === undefined && d.claim === undefined && d.statement === undefined && d.finding === undefined) {
    const q = ctx.body ?? ctx.headline;
    if (q) { d.quote = q; ch("quote ← scene body/headline", "quote"); }
  }
  if (typeof d.stat === "string" || typeof d.stat === "number") {
    d.stat = { value: String(d.stat), label: typeof d.statLabel === "string" ? d.statLabel : (typeof d.label === "string" ? d.label : ctx.headline ?? "") };
    ch("stat string → {value,label}", "stat");
  }
  if (typeof d.date === "number") d.date = String(d.date);
  return d;
}

function preHeadlineCard(d0: Obj, _ctx: CoerceCtx, ch: (n: string, at?: string) => void): Obj {
  const d: Obj = { ...d0 };
  const o = d.outlet ?? d.publication ?? d.publisher ?? d.source ?? d.site ?? d.newspaper;
  for (const k of ["publication", "publisher", "source", "site", "newspaper"]) delete d[k];
  d.outlet = isObj(o) ? firstText(o, ["name", "title", "label"]) : o;
  if (d.outlet === undefined || d.outlet === "") { d.outlet = "News"; ch('outlet missing → "News"', "outlet"); }
  if (typeof d.date === "number") d.date = String(d.date);
  return d;
}

function preBullets(d0: Obj, _ctx: CoerceCtx, ch: (n: string, at?: string) => void): Obj {
  const d: Obj = { ...d0 };
  let items = d.items ?? d.bullets ?? d.points ?? d.list ?? d.steps ?? d.tips ?? d.entries;
  for (const k of ["bullets", "points", "list", "steps", "tips", "entries"]) delete d[k];
  if (typeof items === "string") { items = items.split(/\s*(?:\n|•|;|\|)\s*/).filter(Boolean); ch("items string split", "items"); }
  if (Array.isArray(items)) items = items.map((it) => (isObj(it) && it.text === undefined ? { ...it, text: it.label ?? it.title ?? it.name ?? it.content } : it));
  if (items !== undefined) d.items = items;
  return d;
}

function preIconGrid(d0: Obj, _ctx: CoerceCtx, ch: (n: string, at?: string) => void): Obj {
  const d: Obj = { ...d0 };
  let items = d.items ?? d.tiles ?? d.icons ?? d.list ?? d.entries ?? d.points;
  for (const k of ["tiles", "icons", "list", "entries", "points"]) delete d[k];
  if (typeof items === "string") items = items.split(/\s*(?:\n|•|;|\||,)\s*/).filter(Boolean);
  if (Array.isArray(items)) {
    items = items.map((it, i) => {
      if (typeof it === "string") { ch(`${short(it)} → {icon:"sparkles", label}`, `items[${i}]`); return { icon: "sparkles", label: it }; }
      if (!isObj(it)) return it;
      const o: Obj = { ...it };
      if (o.label === undefined) o.label = o.text ?? o.name ?? o.title;
      if (o.icon === undefined || o.icon === "") { o.icon = typeof o.iconName === "string" ? o.iconName : "sparkles"; ch(`icon → "${o.icon}"`, `items[${i}].icon`); }
      return o;
    });
    d.items = items;
  }
  return d;
}

function preMap(d0: Obj, _ctx: CoerceCtx, ch: (n: string, at?: string) => void): Obj {
  const d: Obj = { ...d0 };
  let regions = d.regions ?? d.countries ?? d.highlight ?? d.highlighted ?? d.areas ?? d.highlights;
  for (const k of ["countries", "highlight", "highlighted", "areas", "highlights"]) delete d[k];
  if (typeof regions === "string") { regions = regions.split(/\s*[,;\n]\s*/).filter(Boolean); ch("regions string split on commas", "regions"); }
  if (regions !== undefined) d.regions = regions;
  let points = d.points ?? d.markers ?? d.cities ?? d.pins ?? d.locations;
  for (const k of ["markers", "cities", "pins", "locations"]) delete d[k];
  if (Array.isArray(points)) {
    points = points.map((p) => {
      if (Array.isArray(p) && p.length >= 2) return { lat: p[0], lon: p[1], ...(p[2] !== undefined ? { label: p[2] } : {}) };
      if (isObj(p) && isObj(p.coordinates)) return { ...p, ...p.coordinates };
      return p;
    });
    d.points = points;
  }
  return d;
}

function preKinetic(d0: Obj, ctx: CoerceCtx, ch: (n: string, at?: string) => void): Obj {
  const d: Obj = { ...d0 };
  const e = d.emphasis ?? d.highlight ?? d.accent ?? d.emphasize ?? d.accentWords ?? d.highlights;
  for (const k of ["highlight", "accent", "emphasize", "accentWords", "highlights"]) delete d[k];
  if (typeof e === "string") {
    const words = e.split(/\s*,\s*/).filter(Boolean);
    d.emphasis = words;
    ch(`emphasis string → [${words.length}]`, "emphasis");
  } else if (e !== undefined) d.emphasis = e;
  if (Array.isArray(d.emphasis) && ctx.headline) {
    // Multi-word emphasis phrases → individual words that exist in the headline.
    const hw = new Set(ctx.headline.toLowerCase().split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}%$'-]/gu, "")));
    const flat = (d.emphasis as unknown[]).flatMap((x) => (typeof x === "string" && x.trim().includes(" ") ? x.trim().split(/\s+/) : [x]));
    const kept = flat.filter((x) => typeof x !== "string" || hw.has(x.toLowerCase().replace(/[^\p{L}\p{N}%$'-]/gu, "")));
    if (kept.length !== (d.emphasis as unknown[]).length) ch("emphasis kept to words in the headline", "emphasis");
    d.emphasis = kept.slice(0, 4);
  }
  return d;
}

function preStrike(d0: Obj, ctx: CoerceCtx, ch: (n: string, at?: string) => void): Obj {
  const d: Obj = { ...d0 };
  if (d.myth === undefined) { const m = d.claim ?? d.belief ?? d.misconception; if (m !== undefined) d.myth = m; }
  if (d.truth === undefined) { const t = d.fact ?? d.correction ?? d.reality ?? d.actually; if (t !== undefined) d.truth = t; }
  for (const k of ["claim", "belief", "misconception", "fact", "correction", "reality", "actually"]) delete d[k];
  if (d.myth === undefined && !ctx.headline && ctx.body) { d.myth = ctx.body; ch("myth ← body", "myth"); }
  return d;
}

function preVideo(d0: Obj, _ctx: CoerceCtx, ch: (n: string, at?: string) => void): Obj {
  const d: Obj = { ...d0 };
  const alt: Record<"inMs" | "outMs", Array<[string, "ms" | "s"]>> = {
    inMs: [["startMs", "ms"], ["fromMs", "ms"], ["in", "s"], ["startSec", "s"], ["start", "s"], ["from", "s"]],
    outMs: [["endMs", "ms"], ["toMs", "ms"], ["out", "s"], ["endSec", "s"], ["end", "s"], ["to", "s"]],
  };
  for (const k of ["inMs", "outMs"] as const) {
    if (d[k] === undefined) for (const [a, unit] of alt[k]) {
      const n = d[a] !== undefined ? toNumber(d[a]) : undefined;
      if (n === undefined) continue;
      // Seconds-looking aliases with small values are seconds; anything ≥ 600 is already ms.
      d[k] = unit === "s" && n < 600 ? Math.round(n * 1000) : n;
      ch(`${a} → ${k}`, k);
      delete d[a];
      break;
    }
  }
  return d;
}

const PRE: Record<string, Pre> = {
  diagram: preDiagram,
  chart: preChart,
  "split-title": preSplitTitle,
  "split-stat": preSplitStat,
  counter: preCounter,
  "numbered-card": preNumbered,
  "source-card": preSourceCard,
  "headline-card": preHeadlineCard,
  "bullet-stack": preBullets,
  "icon-grid": preIconGrid,
  map: preMap,
  "kinetic-headline": preKinetic,
  "strike-through": preStrike,
  "video-segment": preVideo,
};

/**
 * Coerce one block's `data` toward its strict schema. Keeps unknown top-level keys (engine metadata such
 * as `asset`, `cutIn`, `segmentId`) so a coerced plan can be stored and re-used downstream.
 */
export function coerceData(block: string, schema: AnyZ, raw: unknown, ctx: CoerceCtx = {}, path = "data"): { data: unknown; changes: CoerceChange[] } {
  const changes: CoerceChange[] = [];
  const inner0 = unwrap(schema);
  const shapeKeys = def(inner0).type === "object" ? new Set(Object.keys(def(inner0).shape)) : new Set<string>();
  // Already valid and nothing the walker could map (alias keys would otherwise be stripped silently) → keep as is.
  if (ok(schema, raw) && (!isObj(raw) || Object.keys(raw).every((k) => shapeKeys.has(k) || !ALIAS_SOURCES.has(k)))) return { data: raw, changes };
  let d: unknown = raw;
  if (d === null || d === undefined) d = undefined;
  else if (typeof d === "string") {
    try { d = JSON.parse(d); changes.push({ path, note: "data was a JSON string" }); } catch { /* keep */ }
  }
  if (Array.isArray(d)) {
    const first = typeOf(schema) === "object" ? Object.entries(def(unwrap(schema)).shape as Record<string, AnyZ>).find(([, s]) => typeOf(s) === "array") : undefined;
    if (first) { changes.push({ path, note: `bare array → {${first[0]}}` }); d = { [first[0]]: d }; }
  }
  if (isObj(d)) {
    // {data:{…}} or {"<block>":{…}} wrapper
    const keys = Object.keys(d);
    if (keys.length === 1 && (keys[0] === "data" || keys[0] === block) && isObj(d[keys[0]])) { changes.push({ path, note: `unwrapped "${keys[0]}"` }); d = d[keys[0]] as Obj; }
    const inner = unwrap(schema);
    if (def(inner).type === "object") d = applyAliases(d as Obj, new Set(Object.keys(def(inner).shape)), path, changes);
    const pre = PRE[block];
    if (pre) d = pre(d as Obj, ctx, (note, at) => changes.push({ path: at ? `${path}.${at}` : path, note }));
  }
  const out = coerceValue(schema, d, path, changes, true);
  return { data: out, changes };
}

/** Lenient wrapper: z.preprocess that runs `coerceData` (no scene context) before the strict schema. */
export function lenient<S extends AnyZ>(block: string, strict: S): z.ZodPipe<z.ZodTransform<unknown, unknown>, S> {
  return z.preprocess((v) => coerceData(block, strict, v).data, strict) as unknown as z.ZodPipe<z.ZodTransform<unknown, unknown>, S>;
}

// ───────────────────────── prompt shapes ─────────────────────────

function descOf(s: AnyZ): string | undefined {
  let cur: AnyZ | undefined = s;
  for (let i = 0; i < 6 && cur; i++) {
    const m = (z.globalRegistry.get(cur) as { description?: string } | undefined)?.description ?? (cur as { description?: string }).description;
    if (m) return m;
    const d = def(cur);
    cur = d.innerType ?? (d.type === "pipe" ? d.out : undefined);
  }
  return undefined;
}

/** Compact TypeScript-like description of a schema, generated from zod (used in the planner prompt). */
export function shapeOf(schema: AnyZ, depth = 0): string {
  const d = def(schema);
  switch (d.type) {
    case "optional": case "nullable": case "default": case "prefault": return shapeOf(d.innerType, depth);
    case "pipe": return shapeOf(d.out, depth);
    case "string": { const { min, max } = lengthBounds(schema); return `string${max ? `(${min && min > 1 ? `${min}-` : "≤"}${max})` : ""}`; }
    case "number": {
      const b = numBounds(schema);
      const base = b.int ? "int" : "number";
      if (b.min !== undefined && b.max !== undefined && Number.isFinite(b.max)) return `${base}(${b.min}..${b.max})`;
      if (b.min !== undefined) return `${base}(${b.minExcl ? ">" : "≥"}${b.min})`;
      return base;
    }
    case "boolean": return "boolean";
    case "enum": return Object.values(d.entries as Record<string, string>).map((e) => JSON.stringify(e)).join("|");
    case "literal": return JSON.stringify(d.values?.[0] ?? d.value);
    case "union": return (d.options as AnyZ[]).map((o) => shapeOf(o, depth)).join(" | ");
    case "array": {
      const { min, max } = lengthBounds(schema);
      const range = min && max ? ` ${min}-${max} items` : max ? ` ≤${max} items` : min ? ` ≥${min} items` : "";
      return `[${shapeOf(d.element, depth + 1)}]${range}`;
    }
    case "object": {
      const parts = Object.entries(d.shape as Record<string, AnyZ>).map(([k, s]) => {
        const opt = ["optional", "default", "prefault"].includes(def(s).type);
        const dflt = def(s).type === "default" ? (() => { const v = typeof def(s).defaultValue === "function" ? def(s).defaultValue() : def(s).defaultValue; return v === undefined || (Array.isArray(v) && !v.length) || (isObj(v)) ? "" : ` = ${JSON.stringify(v)}`; })() : "";
        const desc = depth === 0 || typeOf(s) !== "object" ? descOf(s) : undefined;
        return `${k}${opt ? "?" : ""}: ${shapeOf(s, depth + 1)}${dflt}${desc ? ` /* ${desc} */` : ""}`;
      });
      return `{ ${parts.join(", ")} }`;
    }
    default: return "any";
  }
}

// ───────────────────────── 3D blocks (chart-3d, globe-3d, stat-3d, scene-3d) ─────────────────────────
// Import declarations are hoisted; kept here so the 3D additions stay in one appended section.
import { placeCoords } from "./three/places";

/** chart-3d: {labels, values} / chart-style series / {Japan: 1130} maps / "Japan: 1130" strings → items[]. */
function preChart3d(d0: Obj, ctx: CoerceCtx, ch: (n: string, at?: string) => void): Obj {
  const d: Obj = { ...d0 };
  let items = d.items ?? d.bars ?? d.columns ?? d.rows ?? d.data;
  for (const k of ["bars", "columns", "rows"]) delete d[k];
  if (items === d.data) delete d.data;
  if (items === undefined && Array.isArray(d.values)) {
    const labels = Array.isArray(d.labels) ? d.labels : [];
    items = (d.values as unknown[]).map((v, i) => ({ label: textOf(labels[i]) ?? `#${i + 1}`, value: v }));
    ch("labels + values → items");
    delete d.values; delete d.labels;
  }
  if (items === undefined && Array.isArray(d.series) && isObj(d.series[0]) && Array.isArray((d.series[0] as Obj).values)) {
    const labels = Array.isArray(d.labels) ? d.labels : [];
    items = ((d.series[0] as Obj).values as unknown[]).map((v, i) => ({ label: textOf(labels[i]) ?? `#${i + 1}`, value: v }));
    ch("chart series[0] → items");
    delete d.series; delete d.labels;
  }
  if (isObj(items)) { items = Object.entries(items).map(([label, value]) => ({ label, value })); ch("object map → items"); }
  if (Array.isArray(items)) {
    let unit: string | undefined;
    items = items.map((it) => {
      if (Array.isArray(it) && it.length >= 2) return { label: textOf(it[0]), value: it[1] };
      if (typeof it === "string") {
        const m = it.match(/^(.*?)[:=–-]\s*([^:=]+)$/);
        if (m) return { label: m[1].trim(), value: m[2].trim() };
      }
      if (isObj(it)) {
        const o: Obj = { ...it };
        if (o.label === undefined) { const l = firstText(o, ["name", "title", "country", "category", "x", "key"]); if (l) o.label = l; }
        if (o.value === undefined) for (const k of ["amount", "y", "count", "total", "number", "stat", "score"]) if (o[k] !== undefined) { o.value = o[k]; break; }
        for (const k of ["name", "title", "country", "category", "x", "key", "amount", "y", "count", "total", "number", "stat", "score"]) delete o[k];
        for (const k of ["highlighted", "winner", "accent", "best", "top"]) if (o[k] !== undefined) { if (o.highlight === undefined) o.highlight = o[k]; delete o[k]; }
        return o;
      }
      return it;
    }).map((it) => {
      if (isObj(it) && typeof it.value === "string") {
        const p = parseNumber(it.value);
        if (p) { unit ??= p.prefix && /^[$€£¥₹]$/.test(p.prefix) ? p.prefix : p.suffix === "%" ? "%" : undefined; return { ...it, value: p.scaled }; }
      }
      return it;
    });
    if (d.unit === undefined && unit) { d.unit = unit; ch(`unit "${unit}" taken from the values`, "unit"); }
    d.items = items;
  }
  const hi = d.highlight ?? d.winner ?? d.highlighted;
  for (const k of ["highlight", "winner", "highlighted"]) delete d[k];
  if (typeof hi === "string" && Array.isArray(d.items)) {
    d.items = (d.items as unknown[]).map((it) => (isObj(it) && norm(String(it.label ?? "")) === norm(hi) ? { ...it, highlight: true } : it));
    ch(`highlight "${hi}" → items[].highlight`, "items");
  }
  if (d.caption === undefined) { const c = d.source ?? d.note ?? d.subtitle ?? d.footnote; if (c !== undefined) { d.caption = textOf(c); ch("caption ← source/note", "caption"); } }
  for (const k of ["source", "note", "subtitle", "footnote", "type"]) delete d[k];
  if (d.title === undefined && !ctx.headline && typeof d.heading === "string") d.title = d.heading;
  if (typeof d.unit === "string") { const s = d.unit.trim().toLowerCase(); if (s === "percent" || s === "percentage") d.unit = "%"; else if (s === "usd" || s === "dollars") d.unit = "$"; }
  return d;
}

/** A place: [lat,lng,label] / {latitude,longitude,name} / "Seoul" → {lat,lng,label}. */
function placeOf(v: unknown, ch: (n: string, at?: string) => void, at: string): unknown {
  if (Array.isArray(v) && v.length >= 2) return { lat: toNumber(v[0]), lng: toNumber(v[1]), ...(v[2] !== undefined ? { label: textOf(v[2]) } : {}) };
  if (typeof v === "string") {
    const c = placeCoords(v);
    if (c) { ch(`"${v}" → ${c.lat}, ${c.lng}`, at); return { ...c, label: v.trim() }; }
    return v;
  }
  if (!isObj(v)) return v;
  const o: Obj = { ...v };
  if (isObj(o.coordinates)) Object.assign(o, o.coordinates);
  if (Array.isArray(o.coordinates) && o.coordinates.length >= 2) { o.lat ??= o.coordinates[0]; o.lng ??= o.coordinates[1]; }
  delete o.coordinates;
  if (o.lat === undefined && o.latitude !== undefined) o.lat = o.latitude;
  if (o.lng === undefined) for (const k of ["lon", "long", "longitude"]) if (o[k] !== undefined) { o.lng = o[k]; break; }
  if (o.label === undefined) { const l = firstText(o, ["name", "city", "title", "place", "country", "text"]); if (l) o.label = l; }
  for (const k of ["latitude", "lon", "long", "longitude", "name", "city", "title", "place", "country", "text"]) delete o[k];
  if ((o.lat === undefined || o.lng === undefined) && typeof o.label === "string") {
    const c = placeCoords(o.label);
    if (c) { o.lat = c.lat; o.lng = c.lng; ch(`coordinates for "${o.label}" looked up`, at); }
  }
  if (o.label === undefined && typeof o.lat === "number" && typeof o.lng === "number") {
    o.label = `${Math.abs(o.lat).toFixed(1)}°${o.lat >= 0 ? "N" : "S"} ${Math.abs(o.lng).toFixed(1)}°${o.lng >= 0 ? "E" : "W"}`;
  }
  return o;
}

function preGlobe3d(d0: Obj, _ctx: CoerceCtx, ch: (n: string, at?: string) => void): Obj {
  const d: Obj = { ...d0 };
  let focus = d.focus ?? d.location ?? d.target ?? d.to ?? d.destination ?? d.place ?? d.city ?? d.point;
  let from = d.from ?? d.origin ?? d.start ?? d.source;
  for (const k of ["location", "target", "to", "destination", "place", "city", "point", "origin", "start", "source"]) delete d[k];
  if (focus === undefined && (d.lat !== undefined || d.latitude !== undefined)) { focus = { lat: d.lat ?? d.latitude, lng: d.lng ?? d.lon ?? d.longitude, label: d.label ?? d.name }; ch("top-level lat/lng → focus", "focus"); }
  for (const k of ["lat", "lng", "lon", "latitude", "longitude", "label", "name"]) delete d[k];
  if (Array.isArray(d.points) && d.points.length) {
    if (focus === undefined) focus = d.points[d.points.length - 1];
    if (from === undefined && d.points.length > 1) from = d.points[0];
    ch("points[] → from/focus", "focus");
  }
  delete d.points;
  if (focus !== undefined) d.focus = placeOf(focus, ch, "focus");
  if (from !== undefined) d.from = placeOf(from, ch, "from");
  return d;
}

function preStat3d(d0: Obj, ctx: CoerceCtx, ch: (n: string, at?: string) => void): Obj {
  const d: Obj = { ...d0 };
  if (d.value === undefined) {
    for (const k of ["word", "phrase", "number", "stat", "amount", "count", "big", "headline"]) if (d[k] !== undefined) { d.value = d[k]; delete d[k]; ch(`${k} → value`, "value"); break; }
  }
  // "text" may already have been renamed to label by the generic alias pass: a label with no value is the value.
  if (d.value === undefined && typeof d.label === "string" && d.label.length <= 14) { d.value = d.label; delete d.label; ch("label → value (no value given)", "value"); }
  if (d.label === undefined) { const l = d.sub ?? d.subtitle ?? d.description ?? d.caption ?? d.subLabel; if (l !== undefined) { d.label = l; ch("label ← subtitle/description", "label"); } }
  for (const k of ["sub", "subtitle", "description", "caption", "subLabel"]) delete d[k];
  const isNumberish = typeof d.value === "string" && (() => { const p = parseNumber(d.value as string); return !!p && !/[a-z]{3,}/i.test(p.suffix); })();
  if (d.value === undefined || typeof d.value === "number" || isNumberish) return preCounter(d, ctx, ch);
  if (typeof d.value === "string") {
    const w = d.value.trim().split(/\s+/);
    if (w.length > 3) { d.value = w.slice(0, 3).join(" "); ch("value kept to 3 words", "value"); }
  }
  return d;
}

const SHAPE_SYNONYMS: Record<string, string> = {
  ball: "sphere", planet: "sphere", sun: "sphere", moon: "sphere", globe: "sphere", earth: "sphere", orb: "sphere", atom: "sphere", circle: "sphere", dot: "sphere", particle: "sphere",
  cube: "box", block: "box", crate: "box", brick: "box", square: "box", cuboid: "box", building: "box",
  donut: "torus", doughnut: "torus", tyre: "torus", tire: "torus",
  pyramid: "cone", triangle: "cone", spike: "cone",
  tube: "cylinder", pipe: "cylinder", can: "cylinder", column: "cylinder", pillar: "cylinder", disc: "cylinder", disk: "cylinder", coin: "cylinder",
  vector: "arrow", force: "arrow", pointer: "arrow", line: "arrow",
  floor: "plane", ground: "plane", surface: "plane", table: "plane", sheet: "plane", board: "plane",
  hoop: "ring", halo: "ring", orbitring: "ring", ellipse: "ring",
};
const MOTION_SYNONYMS: Record<string, string> = {
  rotate: "spin", rotation: "spin", turn: "spin", spinning: "spin", twirl: "spin",
  revolve: "orbit", circle: "orbit", circling: "orbit", orbiting: "orbit", revolution: "orbit",
  float: "bob", hover: "bob", bounce: "bob", bobbing: "bob", wobble: "bob",
  beat: "pulse", throb: "pulse", breathe: "pulse", heartbeat: "pulse", pulsing: "pulse",
  move: "path", translate: "path", slide: "path", travel: "path", fly: "path", moveto: "path", roll: "path",
  appear: "scale-in", pop: "scale-in", popin: "scale-in", grow: "scale-in", enter: "scale-in", fadein: "scale-in", scalein: "scale-in", spawn: "scale-in",
};
const CAMERA_SYNONYMS: Record<string, string> = {
  isometric: "three-quarter", "34": "three-quarter", threequarters: "three-quarter", perspective: "three-quarter", angled: "three-quarter", default: "three-quarter",
  side: "front", straight: "front", frontal: "front", eyelevel: "front",
  overhead: "top", birdseye: "top", topdown: "top", above: "top",
  rotating: "orbit", turntable: "orbit", orbiting: "orbit", circling: "orbit", flyaround: "orbit",
};
const ROLE_SYNONYMS: Record<string, string> = {
  primary: "accent", highlight: "accent", main: "accent", brand: "accent", secondary: "accent2", alt: "accent2", second: "accent2",
  text: "ink", foreground: "ink", white: "ink", black: "ink", fg: "ink", contrast: "ink",
  background: "bg", card: "surface", muted: "surface", neutral: "surface", grey: "surface", gray: "surface", base: "surface",
};

function vecOf(v: unknown): unknown {
  if (isObj(v) && ("x" in v || "y" in v || "z" in v)) return [toNumber(v.x) ?? 0, toNumber(v.y) ?? 0, toNumber(v.z) ?? 0];
  if (Array.isArray(v) && v.length === 2) return [v[0], v[1], 0];
  if (typeof v === "string") { const n = v.split(/[\s,]+/).map(Number).filter((x) => Number.isFinite(x)); if (n.length >= 2) return [n[0], n[1], n[2] ?? 0]; }
  return v;
}
/** Seconds-looking values (< 30) become ms. */
const msOf = (v: unknown): number | undefined => { const n = toNumber(v); return n === undefined ? undefined : n < 30 ? Math.round(n * 1000) : Math.round(n); };

function preScene3d(d0: Obj, _ctx: CoerceCtx, ch: (n: string, at?: string) => void): Obj {
  const d: Obj = { ...d0 };
  let objects = d.objects ?? d.shapes ?? d.elements ?? d.meshes ?? d.primitives ?? d.nodes ?? d.items;
  for (const k of ["shapes", "elements", "meshes", "primitives", "nodes", "items"]) delete d[k];
  if (isObj(objects)) objects = Object.entries(objects).map(([id, o]) => (isObj(o) ? { id, ...o } : o));
  if (typeof d.camera === "string") {
    const n = norm(d.camera);
    const c = CAMERA_SYNONYMS[n] ?? (n.includes("orbit") ? "orbit" : n.includes("top") ? "top" : n.includes("front") ? "front" : undefined);
    if (c && c !== d.camera) { ch(`camera "${d.camera}" → "${c}"`, "camera"); d.camera = c; }
  } else if (d.camera === undefined) { const c = d.view ?? d.cameraPreset ?? d.angle; if (c !== undefined) { d.camera = c; ch("camera ← view", "camera"); } }
  for (const k of ["view", "cameraPreset", "angle"]) delete d[k];
  if (d.caption === undefined) { const c = d.subtitle ?? d.note; if (c !== undefined) d.caption = c; }
  for (const k of ["subtitle", "note"]) delete d[k];
  if (!Array.isArray(objects)) { if (objects !== undefined) d.objects = objects; return d; }
  const ids = new Set<string>();
  const list = objects.map((raw, i) => {
    let o: Obj = typeof raw === "string" ? { shape: raw } : isObj(raw) ? { ...raw } : {};
    if (o.shape === undefined) { const s = o.type ?? o.kind ?? o.geometry ?? o.primitive ?? o.object; if (s !== undefined) o.shape = s; }
    for (const k of ["type", "kind", "geometry", "primitive", "object"]) delete o[k];
    if (typeof o.shape === "string") {
      const n = norm(o.shape);
      const fuzzy = Object.keys(SHAPE_SYNONYMS).find((k) => k.length >= 4 && n.includes(k));
      const s = SHAPE_SYNONYMS[n] ?? (fuzzy ? SHAPE_SYNONYMS[fuzzy] : undefined);
      if (s && !["sphere", "box", "torus", "cone", "cylinder", "arrow", "plane", "ring"].includes(n)) { ch(`shape "${o.shape}" → "${s}"`, `objects[${i}].shape`); o.shape = s; }
    }
    if (o.label === undefined) { const l = o.name ?? o.title ?? o.text; if (l !== undefined) o.label = l; }
    for (const k of ["name", "title", "text"]) delete o[k];
    if (o.position === undefined) { const p = o.pos ?? o.at ?? o.location ?? o.center; if (p !== undefined) o.position = p; else if (o.x !== undefined || o.y !== undefined || o.z !== undefined) o.position = { x: o.x, y: o.y, z: o.z }; }
    for (const k of ["pos", "at", "location", "center", "x", "y", "z"]) delete o[k];
    if (o.position !== undefined) o.position = vecOf(o.position);
    if (o.rotation !== undefined) o.rotation = vecOf(o.rotation);
    if (o.scale === undefined) {
      if (o.radius !== undefined) { const r = toNumber(o.radius); if (r !== undefined) { o.scale = r * 2; ch("radius → scale (diameter)", `objects[${i}].scale`); } }
      else if (o.size !== undefined) o.scale = o.size;
    }
    delete o.radius; delete o.size;
    if (Array.isArray(o.scale) || isObj(o.scale)) { const v = vecOf(o.scale) as unknown[]; const ns = v.map(toNumber).filter((x): x is number => x !== undefined); if (ns.length) { o.scale = ns.reduce((a, b) => a + b, 0) / ns.length; ch("scale vector → uniform", `objects[${i}].scale`); } }
    if (o.color === undefined) { const c = o.colour ?? o.colorRole ?? o.role ?? o.fill; if (c !== undefined) o.color = c; }
    for (const k of ["colour", "colorRole", "role", "fill"]) delete o[k];
    if (typeof o.color === "string" && !["bg", "surface", "ink", "accent", "accent2"].includes(o.color)) {
      const n = norm(o.color);
      const r = ROLE_SYNONYMS[n] ?? (n === "accent2" ? "accent2" : i % 2 ? "accent2" : "accent");
      ch(`color "${o.color}" → role "${r}"`, `objects[${i}].color`); o.color = r;
    }
    let ms = o.motions ?? o.motion ?? o.animations ?? o.animation ?? o.anims ?? o.moves;
    for (const k of ["motion", "animations", "animation", "anims", "moves"]) delete o[k];
    if (ms !== undefined && !Array.isArray(ms)) ms = [ms];
    if (Array.isArray(ms)) {
      o.motions = ms.map((m0, j) => {
        let m: Obj = typeof m0 === "string" ? { type: m0 } : isObj(m0) ? { ...m0 } : {};
        if (m.type === undefined) { const t = m.kind ?? m.name ?? m.animation ?? m.motion; if (t !== undefined) m.type = t; }
        for (const k of ["kind", "name", "animation", "motion"]) delete m[k];
        if (typeof m.type === "string") {
          const n = norm(m.type);
          const t = MOTION_SYNONYMS[n] ?? (["orbit", "spin", "bob", "pulse", "path", "scalein"].includes(n) ? (n === "scalein" ? "scale-in" : n) : undefined);
          if (t && t !== m.type) { ch(`motion "${m.type}" → "${t}"`, `objects[${i}].motions[${j}].type`); m.type = t; }
        }
        if (m.to === undefined) { const t = m.target ?? m.end ?? m.destination ?? m.toPosition; if (t !== undefined && typeof t !== "number") m.to = t; }
        if (m.from === undefined && (Array.isArray(m.start) || isObj(m.start))) { m.from = m.start; delete m.start; }
        for (const k of ["target", "end", "destination", "toPosition"]) delete m[k];
        if (m.to !== undefined) m.to = vecOf(m.to);
        if (m.from !== undefined) m.from = vecOf(m.from);
        if (m.startMs === undefined) { const s = m.start ?? m.delay ?? m.at ?? m.startSec ?? m.begin; if (s !== undefined) { const v = msOf(s); if (v !== undefined) m.startMs = v; } }
        if (m.durationMs === undefined) { const s = m.duration ?? m.dur ?? m.length ?? m.durationSec ?? m.time; if (s !== undefined) { const v = msOf(s); if (v !== undefined) m.durationMs = v; } }
        for (const k of ["start", "delay", "at", "startSec", "begin", "duration", "dur", "length", "durationSec", "time"]) delete m[k];
        if (m.turns === undefined) { const t = m.revolutions ?? m.rotations ?? m.times ?? m.count; if (t !== undefined) m.turns = t; }
        if (m.amount === undefined) { const a = m.height ?? m.amplitude ?? m.distance ?? m.strength; if (a !== undefined) m.amount = a; }
        for (const k of ["revolutions", "rotations", "times", "count", "height", "amplitude", "distance", "strength"]) delete m[k];
        if (typeof m.axis === "string") m.axis = m.axis.trim().toLowerCase().replace(/[^xyz]/g, "").slice(0, 1) || "y";
        return m;
      });
    }
    let id = typeof o.id === "string" || typeof o.id === "number" ? slug(String(o.id)) : "";
    if (!id) { id = slug(String(o.label ?? o.shape ?? `obj-${i + 1}`)) || `obj-${i + 1}`; ch(`id missing → "${id}"`, `objects[${i}].id`); }
    while (ids.has(id)) id = `${id.slice(0, 17)}-${i + 1}`;
    ids.add(id); o.id = id;
    return o;
  });
  // Positions from a bigger coordinate system (pixels, 0..10 grids) are rescaled to fit ±3 instead of clamped.
  const coords = list.flatMap((o) => [o.position, ...(Array.isArray(o.motions) ? (o.motions as Obj[]).flatMap((m) => [m.to, m.from]) : [])])
    .filter((v): v is number[] => Array.isArray(v)).flat().map((v) => toNumber(v) ?? 0);
  const max = Math.max(0, ...coords.map(Math.abs));
  if (max > 4) {
    const k = 3 / max;
    const sc = (v: unknown) => (Array.isArray(v) ? v.map((x) => Math.round((toNumber(x) ?? 0) * k * 100) / 100) : v);
    for (const o of list) {
      o.position = sc(o.position);
      if (Array.isArray(o.motions)) for (const m of o.motions as Obj[]) { m.to = sc(m.to); m.from = sc(m.from); if (m.to === undefined) delete m.to; if (m.from === undefined) delete m.from; }
    }
    ch(`positions rescaled ×${Math.round(k * 1000) / 1000} to fit the view`, "objects");
  }
  d.objects = list;
  return d;
}

Object.assign(PRE, { "chart-3d": preChart3d, "globe-3d": preGlobe3d, "stat-3d": preStat3d, "scene-3d": preScene3d } satisfies Record<string, Pre>);
