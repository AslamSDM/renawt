/**
 * Bridge to Python CV cursor detection service
 * Communicates with FastAPI service running on port 8001
 */

import { CursorEvent } from "@/lib/recording/cursorTracker";

const CV_SERVICE_URL = process.env.CV_SERVICE_URL || "http://localhost:8001";

interface CVDetectionResult {
  status: "complete" | "error" | "processing";
  video_path: string;
  output_path: string;
  cursor_count: number;
  click_count: number;
  duration_ms: number;
  message?: string;
  error?: string;
}

interface CVPosition {
  timestamp: number;
  x: number;
  y: number;
  coord_x: number;
  coord_y: number;
  class_label: "pointer" | "hand" | "text";
  confidence: number;
  type: "move" | "click";
}

/**
 * Detect cursor positions in a video file using CV service
 * @param videoPath Local path to video file
 * @returns Array of cursor events
 */
export async function detectCursorWithCV(
  videoPath: string
): Promise<CursorEvent[]> {
  try {
    console.log(`[CV Bridge] Sending detection request for: ${videoPath}`);

    // Call CV service
    const response = await fetch(`${CV_SERVICE_URL}/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        video_path: videoPath,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `CV service error (${response.status}): ${errorData.detail || response.statusText}`
      );
    }

    const result: CVDetectionResult = await response.json();

    if (result.status === "error") {
      throw new Error(result.error || "Unknown CV error");
    }

    console.log(
      `[CV Bridge] Detection complete: ${result.cursor_count} cursors, ${result.click_count} clicks`
    );

    // Read the JSON file produced by CV service
    const fs = require("fs");
    if (!fs.existsSync(result.output_path)) {
      throw new Error(`Output file not found: ${result.output_path}`);
    }

    const data = JSON.parse(fs.readFileSync(result.output_path, "utf-8"));

    // Convert to CursorEvent format
    const cursorEvents: CursorEvent[] = data.positions.map((pos: CVPosition) => ({
      x: pos.coord_x,
      y: pos.coord_y,
      timestamp: pos.timestamp,
      type: pos.type,
    }));

    return cursorEvents;
  } catch (error) {
    console.error("[CV Bridge] Detection failed:", error);
    throw error;
  }
}

/**
 * Check if CV service is healthy and model is loaded
 */
export async function checkCVServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${CV_SERVICE_URL}/health`, {
      method: "GET",
    });
    const data = await response.json();
    return data.status === "ok" && data.model_loaded === true;
  } catch (error) {
    console.error("[CV Bridge] Health check failed:", error);
    return false;
  }
}

/**
 * Get cursor data from already processed video
 * @param jsonPath Path to the _cursor.json file
 */
export function loadCVCursorData(jsonPath: string): CursorEvent[] {
  try {
    const fs = require("fs");
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Cursor data file not found: ${jsonPath}`);
    }

    const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    
    return data.positions.map((pos: any) => ({
      x: pos.coord_x || pos.x,
      y: pos.coord_y || pos.y,
      timestamp: pos.timestamp,
      type: pos.type || "move",
    }));
  } catch (error) {
    console.error("[CV Bridge] Failed to load cursor data:", error);
    throw error;
  }
}
