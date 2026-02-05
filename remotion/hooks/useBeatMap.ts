import { createContext, useContext } from "react";

// ============================================
// BeatMap Types
// ============================================
export interface BeatMap {
  bpm: number;
  framesPerBeat: number;
  beats: number[];
  downbeats: number[];
  measures: number[];
  energy: number[];
  drops: number[];
  totalDuration: number;
}

// ============================================
// React Context for BeatMap
// ============================================
const BeatMapContext = createContext<BeatMap | null>(null);

export const BeatMapProvider = BeatMapContext.Provider;

export function useBeatMap(): BeatMap {
  const beatMap = useContext(BeatMapContext);
  if (!beatMap) {
    // Return a default beat map if none provided
    return {
      bpm: 120,
      framesPerBeat: 15,
      beats: [],
      downbeats: [],
      measures: [],
      energy: [],
      drops: [],
      totalDuration: 1800,
    };
  }
  return beatMap;
}
