/** Minimal structured JSON logger (one line per event; CloudWatch/ECS friendly). */
import { env } from "./env.js";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (ORDER[level] < ORDER[env.logLevel]) return;
  const line: Record<string, unknown> = { t: new Date().toISOString(), level, msg, ...fields };
  if (fields?.err instanceof Error) line.err = { message: fields.err.message, stack: fields.err.stack };
  const out = JSON.stringify(line);
  if (level === "error" || level === "warn") process.stderr.write(out + "\n");
  else process.stdout.write(out + "\n");
}

export interface Logger {
  debug(msg: string, f?: Record<string, unknown>): void;
  info(msg: string, f?: Record<string, unknown>): void;
  warn(msg: string, f?: Record<string, unknown>): void;
  error(msg: string, f?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

export function createLogger(bindings: Record<string, unknown> = {}): Logger {
  return {
    debug: (m, f) => emit("debug", m, { ...bindings, ...f }),
    info: (m, f) => emit("info", m, { ...bindings, ...f }),
    warn: (m, f) => emit("warn", m, { ...bindings, ...f }),
    error: (m, f) => emit("error", m, { ...bindings, ...f }),
    child: (b) => createLogger({ ...bindings, ...b }),
  };
}

export const log = createLogger({ svc: "engine" });

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
