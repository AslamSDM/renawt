import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Pinned CLI version (devDependency). */
export const HYPERFRAMES_VERSION = "0.8.212";

function localBin(): string | null {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const p = join(dir, "node_modules", ".bin", "hyperframes");
    if (existsSync(p)) return p;
    dir = dirname(dir);
  }
  return null;
}

function cmd(): { bin: string; pre: string[] } {
  const local = localBin();
  return local ? { bin: local, pre: [] } : { bin: "npx", pre: ["-y", `hyperframes@${HYPERFRAMES_VERSION}`] };
}

let available: string | null | undefined;
/** CLI version string when the hyperframes CLI can run here, else null. Cached. */
export function hyperframesVersion(): string | null {
  if (available !== undefined) return available;
  try {
    const { bin, pre } = cmd();
    const r = spawnSync(bin, [...pre, "--version"], { encoding: "utf8", timeout: 120_000 });
    available = r.status === 0 ? r.stdout.trim().split("\n").pop() ?? null : null;
  } catch {
    available = null;
  }
  return available;
}

export interface CliResult { ok: boolean; code: number | null; stdout: string; stderr: string; json?: unknown }

function run(args: string[], cwd: string, timeoutMs: number): Promise<CliResult> {
  const { bin, pre } = cmd();
  return new Promise((res) => {
    const cp = spawn(bin, [...pre, ...args], { cwd, env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1", DO_NOT_TRACK: "1" } });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => cp.kill("SIGKILL"), timeoutMs);
    cp.stdout.on("data", (d) => (stdout += d));
    cp.stderr.on("data", (d) => (stderr += d));
    cp.on("close", (code) => {
      clearTimeout(timer);
      let json: unknown;
      const brace = stdout.indexOf("{");
      if (args.includes("--json") && brace >= 0) { try { json = JSON.parse(stdout.slice(brace)); } catch { /* not json */ } }
      res({ ok: code === 0, code, stdout, stderr, json });
    });
    cp.on("error", (e) => { clearTimeout(timer); res({ ok: false, code: null, stdout, stderr: String(e) }); });
  });
}

/** `npx hyperframes lint --json <dir>`. Returns null when the CLI is unavailable. */
export async function runHyperframesLint(dir: string): Promise<(CliResult & { errors: string[]; warnings: string[] }) | null> {
  if (!hyperframesVersion()) return null;
  const r = await run(["lint", "--json", dir], dir, 180_000);
  const findings = ((r.json as { findings?: Array<{ severity?: string; code?: string; message?: string; file?: string }> })?.findings) ?? [];
  const fmt = (f: { code?: string; message?: string; file?: string }) => `${f.file ? `${f.file}: ` : ""}${f.code ?? ""} ${f.message ?? ""}`.trim();
  return {
    ...r,
    errors: findings.filter((f) => f.severity === "error").map(fmt),
    warnings: findings.filter((f) => f.severity === "warning").map(fmt),
  };
}

/** `npx hyperframes render <dir> --quality <q> --output <out>`. */
export async function runHyperframesRender(dir: string, output: string, quality: "draft" | "looks" | "standard" | "high" | "delivery" = "draft", timeoutMs = 20 * 60_000): Promise<CliResult | null> {
  if (!hyperframesVersion()) return null;
  return run(["render", dir, "--quality", quality, "--output", output, "--quiet"], dir, timeoutMs);
}
