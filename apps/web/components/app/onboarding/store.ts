"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Mascot, Persona, VisualSkin, Voice } from "@remawt/shared";
import { DEFAULT_PERSONA, defaultSkin, defaultVoice } from "../kit/defaults";

export const STEPS = [
  { id: "niche", label: "Niche" },
  { id: "audience", label: "Audience" },
  { id: "skin", label: "Look" },
  { id: "voice", label: "Voice" },
  { id: "persona", label: "Persona" },
  { id: "mascot", label: "Mascot" },
  { id: "review", label: "Review" },
] as const;
export type StepId = (typeof STEPS)[number]["id"];

interface Draft {
  step: number;
  furthest: number;
  niche: string | null;
  audience: string;
  promise: string;
  skin: VisualSkin;
  voice: Voice;
  persona: Persona;
  mascot: Mascot;
  name: string;
  handle: string;
}

interface OnboardingState extends Draft {
  set: (patch: Partial<Draft>) => void;
  go: (step: number) => void;
  reset: () => void;
}

const initial = (): Draft => ({
  step: 0,
  furthest: 0,
  niche: null,
  audience: "",
  promise: "",
  skin: defaultSkin(),
  voice: defaultVoice(),
  persona: structuredClone(DEFAULT_PERSONA),
  mascot: { enabled: false },
  name: "",
  handle: "",
});

/** Wizard draft. Persisted to sessionStorage so a refresh doesn't lose the kit. */
export const useOnboarding = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...initial(),
      set: (patch) => set(patch),
      go: (step) => set({ step, furthest: Math.max(get().furthest, step) }),
      reset: () => set(initial()),
    }),
    { name: "remawt-onboarding", storage: createJSONStorage(() => sessionStorage), version: 1 },
  ),
);
