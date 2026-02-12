/**
 * Cursor tracking utility for screen recordings
 * Tracks mouse position, clicks, and keyboard input
 */

export interface CursorEvent {
  x: number;
  y: number;
  timestamp: number;
  type: "move" | "click" | "input";
}

export class CursorTracker {
  private events: CursorEvent[] = [];
  private startTime: number = 0;
  private lastInputTime: number = 0;
  private lastMoveEvent: CursorEvent | null = null;
  private moveTimeout: NodeJS.Timeout | null = null;
  private isTracking: boolean = false;

  start(): void {
    if (this.isTracking) return;
    
    this.isTracking = true;
    this.startTime = Date.now();
    this.events = [];
    this.lastInputTime = 0;
    this.lastMoveEvent = null;

    // Add event listeners
    document.addEventListener("mousemove", this.handleMouseMove);
    document.addEventListener("mousedown", this.handleMouseDown);
    document.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("keypress", this.handleKeyInput);
    document.addEventListener("keyup", this.handleKeyInput);
  }

  stop(): CursorEvent[] {
    if (!this.isTracking) return this.events;

    this.isTracking = false;

    // Clear any pending move timeout
    if (this.moveTimeout) {
      clearTimeout(this.moveTimeout);
      this.moveTimeout = null;
    }

    // Remove event listeners
    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("mousedown", this.handleMouseDown);
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keypress", this.handleKeyInput);
    document.removeEventListener("keyup", this.handleKeyInput);

    return this.events;
  }

  private getTimestamp(): number {
    return Date.now() - this.startTime;
  }

  private handleMouseMove = (e: MouseEvent): void => {
    const timestamp = this.getTimestamp();
    
    // Skip rapid movements (distance > 100px from last recorded position)
    if (this.lastMoveEvent) {
      const distance = Math.sqrt(
        Math.pow(e.clientX - this.lastMoveEvent.x, 2) +
        Math.pow(e.clientY - this.lastMoveEvent.y, 2)
      );
      
      if (distance > 100) {
        // Still record it but mark the gap
        this.events.push({
          x: e.clientX,
          y: e.clientY,
          timestamp,
          type: "move"
        });
        this.lastMoveEvent = this.events[this.events.length - 1];
        return;
      }
    }

    // Debounce move events - only record every 33ms (30fps)
    if (this.moveTimeout) {
      clearTimeout(this.moveTimeout);
    }

    this.moveTimeout = setTimeout(() => {
      this.events.push({
        x: e.clientX,
        y: e.clientY,
        timestamp,
        type: "move"
      });
      this.lastMoveEvent = this.events[this.events.length - 1];
    }, 33);
  };

  private handleMouseDown = (e: MouseEvent): void => {
    const timestamp = this.getTimestamp();
    
    // Record click immediately
    this.events.push({
      x: e.clientX,
      y: e.clientY,
      timestamp,
      type: "click"
    });

    // Clear any pending move to avoid duplicate positions
    if (this.moveTimeout) {
      clearTimeout(this.moveTimeout);
      this.moveTimeout = null;
    }

    this.lastMoveEvent = this.events[this.events.length - 1];
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Don't track special keys (Ctrl, Alt, Shift, etc.)
    if (["Control", "Alt", "Shift", "Meta", "Tab", "Escape"].includes(e.key)) {
      return;
    }

    this.handleKeyInput();
  };

  private handleKeyInput = (): void => {
    const timestamp = this.getTimestamp();
    
    // Throttle input events (1 per second max)
    if (timestamp - this.lastInputTime > 1000) {
      this.events.push({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        timestamp,
        type: "input"
      });
      this.lastInputTime = timestamp;
    }
  };

  isActive(): boolean {
    return this.isTracking;
  }

  getEventCount(): number {
    return this.events.length;
  }
}

/**
 * Detect zoom points from cursor events
 * Zooms on clicks and inputs, skips rapid movements
 */
export function detectZoomPoints(events: CursorEvent[]): Array<{
  time: number;
  x: number;
  y: number;
  scale: number;
  duration: number;
}> {
  const zooms: Array<{
    time: number;
    x: number;
    y: number;
    scale: number;
    duration: number;
  }> = [];

  let lastZoomTime = -5000; // Minimum 5 seconds between zooms

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    if (event.type === "click" || event.type === "input") {
      // Skip if too close to last zoom
      if (event.timestamp - lastZoomTime < 5000) continue;

      // Check if followed by rapid movement (check next 500ms)
      let hasRapidMovement = false;
      for (let j = i + 1; j < events.length; j++) {
        const nextEvent = events[j];
        if (nextEvent.timestamp > event.timestamp + 500) break;

        if (nextEvent.type === "move") {
          const distance = Math.sqrt(
            Math.pow(nextEvent.x - event.x, 2) +
            Math.pow(nextEvent.y - event.y, 2)
          );
          if (distance > 50) {
            hasRapidMovement = true;
            break;
          }
        }
      }

      if (hasRapidMovement) continue;

      // Normalize coordinates to 0-1 range
      // Use window dimensions in browser, fallback to 1920x1080 on server
      const viewW = typeof window !== "undefined" ? window.innerWidth : 1920;
      const viewH = typeof window !== "undefined" ? window.innerHeight : 1080;
      zooms.push({
        time: event.timestamp / 1000, // Convert to seconds
        x: event.x / viewW,
        y: event.y / viewH,
        scale: 1.5,
        duration: 2 // 2 seconds
      });

      lastZoomTime = event.timestamp;
    }
  }

  // Limit to max 5 zooms
  return zooms.slice(0, 5);
}

/**
 * Get cursor position at a specific time (with interpolation)
 */
export function getCursorAtTime(
  events: CursorEvent[],
  timeMs: number
): CursorEvent | null {
  if (events.length === 0) return null;

  // Find the events surrounding this time
  let before = events[0];
  let after = events[events.length - 1];

  for (let i = 0; i < events.length; i++) {
    if (events[i].timestamp <= timeMs) {
      before = events[i];
    }
    if (events[i].timestamp >= timeMs && after.timestamp < events[i].timestamp) {
      after = events[i];
      break;
    }
  }

  // If exact match
  if (before.timestamp === timeMs) return before;
  if (after.timestamp === timeMs) return after;

  // Interpolate position
  const timeDiff = after.timestamp - before.timestamp;
  if (timeDiff === 0) return before;

  const progress = (timeMs - before.timestamp) / timeDiff;

  return {
    x: before.x + (after.x - before.x) * progress,
    y: before.y + (after.y - before.y) * progress,
    timestamp: timeMs,
    type: before.type // Use the type from the earlier event
  };
}

/**
 * Get zoom settings at a specific time
 */
export function getZoomAtTime(
  zoomPoints: Array<{
    time: number;
    x: number;
    y: number;
    scale: number;
    duration: number;
  }>,
  timeSec: number
): { scale: number; x: number; y: number } {
  const defaultZoom = { scale: 1, x: 0.5, y: 0.5 };

  const activeZoom = zoomPoints.find((zoom) => {
    const start = zoom.time;
    const end = zoom.time + zoom.duration;
    return timeSec >= start && timeSec <= end;
  });

  if (!activeZoom) return defaultZoom;

  // Smooth easing
  const progress = (timeSec - activeZoom.time) / activeZoom.duration;
  
  // Ease in-out function
  const easeInOut = (t: number): number => {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  };

  let scale: number;
  if (progress < 0.2) {
    // Easing in
    scale = 1 + (activeZoom.scale - 1) * easeInOut(progress / 0.2);
  } else if (progress > 0.8) {
    // Easing out
    scale = 1 + (activeZoom.scale - 1) * easeInOut((1 - progress) / 0.2);
  } else {
    // Full zoom
    scale = activeZoom.scale;
  }

  return {
    scale,
    x: activeZoom.x,
    y: activeZoom.y
  };
}
