import { Response } from "express";

export function createSSESend(res: Response) {
  return (type: string, data: any) => {
    res.write(JSON.stringify({ type, data }) + "\n");
  };
}

export function setupSSE(res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
}
