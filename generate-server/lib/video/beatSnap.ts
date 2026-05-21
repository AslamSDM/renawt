/**
 * Beat-aware utilities for Jitter video composition.
 *
 * - Primary use: feed beatMs into the composer prompt so the agent
 *   places ops on the grid natively.
 * - Safety net: `snapDocToBeats` snaps any stray timing to the nearest
 *   half-beat after composition, and rounds artboard durations to
 *   whole beats. Use only if the agent strays off-grid.
 */

import type { JitterDoc } from "./jitterJson";

export interface BeatGrid {
  bpm: number;
  beatMs: number;
  halfBeatMs: number;
  /** Suggested cell size for op times (= halfBeatMs by default). */
  cellMs: number;
}

export function beatGridForBpm(bpm: number): BeatGrid {
  const beatMs = 60000 / bpm;
  return {
    bpm,
    beatMs,
    halfBeatMs: beatMs / 2,
    cellMs: beatMs / 2,
  };
}

function snapToCell(ms: number, cellMs: number): number {
  return Math.round(ms / cellMs) * cellMs;
}

export interface SnapStats {
  opsShifted: number;
  artboardsResized: number;
  totalDriftMs: number;
}

/**
 * Snap all operation times to the half-beat grid and round each artboard's
 * duration to whole beats. Deep-clones the doc — does not mutate.
 */
export function snapDocToBeats(doc: JitterDoc): {
  doc: JitterDoc;
  stats: SnapStats;
} {
  const bpm = doc.audio?.bpm;
  if (!bpm) return { doc, stats: { opsShifted: 0, artboardsResized: 0, totalDriftMs: 0 } };

  const grid = beatGridForBpm(bpm);
  const cloned: JitterDoc = JSON.parse(JSON.stringify(doc));
  const stats: SnapStats = {
    opsShifted: 0,
    artboardsResized: 0,
    totalDriftMs: 0,
  };

  for (const art of cloned.conf.artboards) {
    const beatsInArt = Math.max(1, Math.round(art.duration / grid.beatMs));
    const newDur = Math.round(beatsInArt * grid.beatMs);
    if (newDur !== art.duration) {
      stats.totalDriftMs += Math.abs(newDur - art.duration);
      stats.artboardsResized += 1;
      art.duration = newDur;
    }
    for (const op of art.operations) {
      const oldStart = op.startTime;
      const snappedStart = snapToCell(op.startTime, grid.cellMs);
      if (snappedStart !== oldStart) {
        stats.opsShifted += 1;
        op.startTime = snappedStart;
      }
      if (op.endTime != null) {
        const oldEnd = op.endTime;
        let snappedEnd = snapToCell(op.endTime, grid.cellMs);
        // Ensure positive duration of at least one cell.
        if (snappedEnd <= op.startTime) {
          snappedEnd = op.startTime + grid.cellMs;
        }
        if (snappedEnd !== oldEnd) op.endTime = snappedEnd;
      }
    }
  }

  return { doc: cloned, stats };
}

/**
 * Pretty-print the beat grid for the agent's user prompt.
 */
export function describeBeatGrid(grid: BeatGrid): string {
  return [
    `BPM: ${grid.bpm}`,
    `beatMs: ${Math.round(grid.beatMs)} ms (one beat)`,
    `halfBeatMs: ${Math.round(grid.halfBeatMs)} ms`,
    `Place every operation startTime and endTime at a multiple of ${Math.round(grid.halfBeatMs)} ms.`,
    `Each artboard.duration MUST be a whole multiple of ${Math.round(grid.beatMs)} ms.`,
    `Two-bar (8 beats) units feel natural for scene breaks: ${Math.round(grid.beatMs * 8)} ms.`,
  ].join("\n");
}
