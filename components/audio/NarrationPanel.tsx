"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Play, Pause, Loader2, ChevronDown, Volume2 } from "lucide-react";

export interface NarrationVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
}

export interface NarrationState {
  enabled: boolean;
  text: string;
  voiceId: string;
  audioUrl: string | null;
  duration: number | null;
}

interface NarrationPanelProps {
  state: NarrationState;
  onChange: (state: NarrationState) => void;
  vpsApiUrl: string;
  getToken: () => Promise<string | null>;
}

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel

export function NarrationPanel({ state, onChange, vpsApiUrl, getToken }: NarrationPanelProps) {
  const [voices, setVoices] = useState<NarrationVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [voiceDropdownOpen, setVoiceDropdownOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const set = (patch: Partial<NarrationState>) => onChange({ ...state, ...patch });

  // Load voices on first expand
  useEffect(() => {
    if (!state.enabled || voices.length > 0) return;
    loadVoices();
  }, [state.enabled]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setVoiceDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Stop audio on unmount
  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  const loadVoices = async () => {
    setLoadingVoices(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${vpsApiUrl}/api/creative/narrate/voices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.voices) setVoices(data.voices);
    } catch {
      // Use fallback list — server will return preset voices even without ElevenLabs key
    } finally {
      setLoadingVoices(false);
    }
  };

  const generateNarration = async () => {
    if (!state.text.trim()) {
      setError("Enter narration text first");
      return;
    }
    setError(null);
    setGenerating(true);

    // Clear old audio
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
    set({ audioUrl: null, duration: null });

    try {
      const token = await getToken();
      if (!token) throw new Error("Auth failed");

      const res = await fetch(`${vpsApiUrl}/api/creative/narrate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: state.text.trim(),
          voiceId: state.voiceId || DEFAULT_VOICE_ID,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      set({ audioUrl: data.audioUrl, duration: data.duration });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate narration");
    } finally {
      setGenerating(false);
    }
  };

  const togglePlay = () => {
    if (!state.audioUrl) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio(state.audioUrl);
        audioRef.current.onended = () => setPlaying(false);
      }
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const selectedVoice = voices.find((v) => v.voice_id === (state.voiceId || DEFAULT_VOICE_ID));
  const voiceName = selectedVoice?.name || "Rachel";

  return (
    <div className="space-y-2">
      {/* Header toggle */}
      <div className="flex items-center justify-between">
        <label className="text-xs tracking-widest text-gray-500 uppercase">
          Narration (Voice-Over)
        </label>
        <button
          onClick={() => {
            set({ enabled: !state.enabled });
            if (!state.enabled && voices.length === 0) loadVoices();
          }}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            state.enabled ? "bg-white" : "bg-white/10"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
              state.enabled ? "translate-x-5 bg-black" : "translate-x-0 bg-gray-500"
            }`}
          />
        </button>
      </div>

      {state.enabled && (
        <div className="space-y-3 bg-white/3 border border-white/8 rounded-lg p-3">
          {/* Voice selector */}
          <div className="space-y-1" ref={dropdownRef}>
            <label className="text-xs text-gray-500">Voice</label>
            <div className="relative">
              <button
                onClick={() => {
                  setVoiceDropdownOpen((o) => !o);
                  if (voices.length === 0) loadVoices();
                }}
                className="w-full flex items-center justify-between px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:border-white/20 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5 text-gray-400" />
                  <span>{loadingVoices ? "Loading voices..." : voiceName}</span>
                  {selectedVoice?.description && (
                    <span className="text-gray-500 text-xs">— {selectedVoice.description}</span>
                  )}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${voiceDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {voiceDropdownOpen && voices.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-[#1a1a1a] border border-white/15 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                  {voices.map((voice) => (
                    <button
                      key={voice.voice_id}
                      onClick={() => {
                        set({ voiceId: voice.voice_id, audioUrl: null, duration: null });
                        setVoiceDropdownOpen(false);
                        audioRef.current?.pause();
                        audioRef.current = null;
                        setPlaying(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-white/8 transition-colors text-left ${
                        (state.voiceId || DEFAULT_VOICE_ID) === voice.voice_id
                          ? "bg-white/10 text-white"
                          : "text-gray-300"
                      }`}
                    >
                      <span className="font-medium">{voice.name}</span>
                      {voice.description && (
                        <span className="text-xs text-gray-500">{voice.description}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Narration text */}
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Script</label>
            <textarea
              value={state.text}
              onChange={(e) => {
                set({ text: e.target.value, audioUrl: null, duration: null });
                setError(null);
              }}
              placeholder="Enter the voice-over script for your video. This will be spoken by the AI narrator."
              rows={4}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 focus:border-white/30 focus:outline-none transition-colors resize-none text-sm rounded-lg"
            />
            <div className="flex justify-between items-center text-xs text-gray-600">
              <span>{state.text.trim().split(/\s+/).filter(Boolean).length} words</span>
              {state.text.trim() && (
                <span>~{Math.ceil(state.text.trim().split(/\s+/).filter(Boolean).length / 2.5)}s</span>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          {/* Generate + preview */}
          <div className="flex items-center gap-2">
            <button
              onClick={generateNarration}
              disabled={generating || !state.text.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white/10 hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed border border-white/15 rounded-lg text-sm transition-colors"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  {state.audioUrl ? "Regenerate" : "Generate Preview"}
                </>
              )}
            </button>

            {state.audioUrl && (
              <button
                onClick={togglePlay}
                className="p-2 bg-white/10 hover:bg-white/15 border border-white/15 rounded-lg transition-colors"
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
            )}
          </div>

          {/* Status when audio ready */}
          {state.audioUrl && (
            <div className="flex items-center gap-2 text-xs text-green-400">
              <Volume2 className="w-3.5 h-3.5" />
              <span>
                Narration ready{state.duration ? ` (~${state.duration.toFixed(1)}s)` : ""} — will be embedded in video
              </span>
            </div>
          )}

          {!state.audioUrl && !generating && (
            <p className="text-xs text-gray-600">
              Generate a preview to hear the narration before creating your video.
              The audio will be automatically embedded in the final composition.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
