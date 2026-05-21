import pino from "pino";
import pinoHttp from "pino-http";
import { randomUUID } from "crypto";

const level = process.env.LOG_LEVEL || "info";

export const logger = pino({
  level,
  base: { service: "scraper-service" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers["x-request-id"];
    const id =
      (typeof incoming === "string" && incoming) ||
      (Array.isArray(incoming) && incoming[0]) ||
      randomUUID();
    res.setHeader("x-request-id", id);
    return id;
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});
