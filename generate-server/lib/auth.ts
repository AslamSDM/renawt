import { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export async function jwtAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const secret = process.env.API_KEY;
  if (!secret) {
    // Dev mode — no auth required
    req.userId = "dev-user";
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const token = authHeader.slice(7);
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (!payload.sub) {
      return res.status(401).json({ error: "Invalid token: missing subject" });
    }
    req.userId = payload.sub;
    next();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Token verification failed";
    return res
      .status(401)
      .json({ error: `Invalid or expired token: ${message}` });
  }
}
