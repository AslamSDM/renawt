import { Response } from "express";

export function createSSESend(res: Response) {
  return (type: string, data: any) => {
    res.write(JSON.stringify({ type, data }) + "\n");
  };
}

/**
 * Sets up SSE headers and starts a heartbeat ping every 15 seconds
 * to keep the connection alive through Cloudflare and other proxies.
 * Returns a cleanup function to stop the heartbeat — call it before res.end().
 */
export function setupSSE(res: Response): () => void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send a heartbeat ping every 15s to prevent proxy timeouts
  const heartbeat = setInterval(() => {
    try {
      res.write(JSON.stringify({ type: "ping", data: {} }) + "\n");
    } catch {
      // Connection already closed, clean up
      clearInterval(heartbeat);
    }
  }, 15_000);

  // Also clean up if the client disconnects
  res.on("close", () => clearInterval(heartbeat));

  return () => clearInterval(heartbeat);
}
