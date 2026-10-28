/** Express helpers: bearer auth + x-user-id, zod body parsing, async handler with typed HTTP errors. */
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { timingSafeEqual } from "node:crypto";
import type { z } from "zod";
import { env } from "../lib/env.js";
import { log, errMsg } from "../lib/logger.js";
import { db } from "../lib/db.js";

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}

export function bearerOk(header: string | undefined): boolean {
  if (!env.apiKey) return process.env.NODE_ENV !== "production"; // dev: open when API_KEY unset
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(token), b = Buffer.from(env.apiKey);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requireAuth(opts: { user?: boolean } = { user: true }): RequestHandler {
  return (req, res, next) => {
    if (!bearerOk(req.header("authorization"))) return void res.status(401).json({ error: "unauthorized" });
    const userId = req.header("x-user-id");
    if (opts.user && !userId) return void res.status(400).json({ error: "x-user-id header required" });
    res.locals.userId = userId;
    next();
  };
}

export function parse<S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, "invalid request body", r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  return r.data;
}

export const handle = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const out = await fn(req, res);
    if (!res.headersSent) res.json(out ?? { ok: true });
  } catch (e) {
    next(e);
  }
};

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const status = err instanceof HttpError ? err.status : (err as { status?: number })?.status ?? 500;
  if (status >= 500) log.error("request failed", { path: req.path, err: errMsg(err), stack: (err as Error)?.stack?.split("\n").slice(0, 5).join(" | ") });
  res.status(status).json({ error: status >= 500 ? "internal error" : errMsg(err), details: err instanceof HttpError ? err.details : undefined });
}

export async function ownedChannel(channelId: string, userId: string) {
  const c = await db().channel.findUnique({ where: { id: channelId } });
  if (!c || c.userId !== userId) throw new HttpError(404, "channel not found");
  return c;
}

export async function ownedVideo(videoId: string, userId: string) {
  const v = await db().video.findUnique({ where: { id: videoId }, include: { channel: true } });
  if (!v || v.channel.userId !== userId) throw new HttpError(404, "video not found");
  return v;
}

export const userId = (res: Response): string => res.locals.userId as string;
