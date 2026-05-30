"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Undo2, Save, Music, X } from "lucide-react";
import { JitterComposition } from "@/remotion/compositions/JitterComposition";
import { AudioSelector, type AudioFile } from "@/components/audio/AudioSelector";
import { Timeline } from "./Timeline";
import { LayerTree } from "./LayerTree";
import { PropertyPanel } from "./PropertyPanel";
import {
  getLayer,
  setLayer,
  totalDurationMs,
  type JitterDoc,
  type LayerPath,
  type AnyLayerLite,
} from "./types";

interface Props {
  projectId: string;
  initialDoc: JitterDoc;
  open: boolean;
  onClose: () => void;
}

const DEBOUNCE_MS = 600;

export function JitterEditor({ projectId, initialDoc, open, onClose }: Props) {
  const [doc, setDoc] = useState<JitterDoc>(initialDoc);
  const [selected, setSelected] = useState<LayerPath | null>(null);
  const [historyCount, setHistoryCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);

  const playerRef = useRef<PlayerRef>(null);
  const lastSavedRef = useRef<string>(JSON.stringify(initialDoc));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external doc changes (e.g. loading a different generation).
  useEffect(() => {
    setDoc(initialDoc);
    lastSavedRef.current = JSON.stringify(initialDoc);
  }, [initialDoc]);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/projects/${projectId}/jitter-doc`)
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.historyCount === "number") {
          setHistoryCount(data.historyCount);
        }
      })
      .catch(() => {});
  }, [projectId, open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const persist = async (next: JitterDoc) => {
    const serialized = JSON.stringify(next);
    if (serialized === lastSavedRef.current) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/jitter-doc`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");
      lastSavedRef.current = serialized;
      setHistoryCount(data.historyCount ?? historyCount);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const scheduleSave = (next: JitterDoc) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persist(next), DEBOUNCE_MS);
  };

  const updateDoc = (next: JitterDoc) => {
    setDoc(next);
    scheduleSave(next);
  };

  const patchLayer = (patch: Partial<AnyLayerLite>) => {
    if (!selected) return;
    updateDoc(setLayer(doc, selected, patch));
  };

  const updateAudio = (audio: AudioFile | null) => {
    const next: JitterDoc = {
      ...doc,
      audio: audio
        ? { url: audio.url, bpm: audio.bpm ?? 124, volume: 0.6 }
        : null,
    };
    updateDoc(next);
    setShowMusicPicker(false);
  };

  const undo = async () => {
    if (historyCount <= 0) return;
    const res = await fetch(`/api/projects/${projectId}/jitter-doc/undo`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      setSaveError(data?.error || "Undo failed");
      return;
    }
    setDoc(data.doc);
    lastSavedRef.current = JSON.stringify(data.doc);
    setHistoryCount(data.historyCount ?? 0);
  };

  const selectedLayer = selected ? getLayer(doc, selected) : null;

  const playerProps = useMemo(() => {
    const fps = doc.fps ?? 30;
    const totalMs = totalDurationMs(doc);
    const durationInFrames = Math.max(1, Math.round((totalMs * fps) / 1000));
    const first = doc.conf?.artboards?.[0];
    return {
      fps,
      durationInFrames,
      compositionWidth: first?.width ?? 1920,
      compositionHeight: first?.height ?? 1080,
    };
  }, [doc]);

  const playerKey = useMemo(() => JSON.stringify(doc).length, [doc]);

  const currentAudio: AudioFile | null = doc.audio
    ? {
        key: doc.audio.url,
        url: doc.audio.url,
        name: (doc.audio as any).title ?? "Selected track",
        bpm: doc.audio.bpm,
      }
    : null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface text-ink">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 h-14 px-4 border-b border-rule shrink-0">
        <div className="flex items-center gap-3">
          <span className="kinetic-pill !py-1 !px-2.5">
            <span className="accent-dot" />
            <span className="mono-tick" style={{ color: "var(--ink)" }}>EDITOR</span>
          </span>
          <button
            onClick={undo}
            disabled={historyCount <= 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-rule text-xs hover:bg-paper-2 disabled:opacity-40 disabled:cursor-not-allowed"
            title={`Undo (${historyCount} steps)`}
          >
            <Undo2 className="w-3.5 h-3.5" /> Undo
          </button>
          <span className="text-[11px] text-muted">
            {saving ? (
              <span className="flex items-center gap-1"><Save className="w-3 h-3" /> saving…</span>
            ) : (
              <span>{historyCount} steps</span>
            )}
          </span>
          {saveError ? <span className="text-xs text-red-400">{saveError}</span> : null}
        </div>

        <div className="relative flex items-center gap-2">
          <button
            onClick={() => setShowMusicPicker((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded border border-rule text-xs hover:bg-paper-2"
          >
            <Music className="w-3.5 h-3.5" />
            {currentAudio?.name ?? "Pick music"}
            {doc.audio?.bpm ? <span className="text-muted">· {doc.audio.bpm} BPM</span> : null}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-rule text-xs hover:bg-paper-2"
            title="Close editor (Esc)"
          >
            <X className="w-4 h-4" /> Close
          </button>

          {showMusicPicker ? (
            <div className="absolute right-0 top-full mt-2 w-[360px] max-h-[60vh] overflow-y-auto rounded-lg border border-rule bg-surface shadow-xl p-3 z-20">
              <AudioSelector selectedAudio={currentAudio} onSelect={updateAudio} />
            </div>
          ) : null}
        </div>
      </header>

      {/* Middle: preview + properties */}
      <div className="flex flex-1 min-h-0">
        {/* Preview */}
        <div className="flex-1 min-w-0 flex items-center justify-center bg-black/40 p-4">
          <div className="rounded-lg overflow-hidden border border-rule bg-black max-h-full max-w-full">
            <Player
              ref={playerRef}
              key={playerKey}
              component={JitterComposition as any}
              inputProps={doc as any}
              fps={playerProps.fps}
              durationInFrames={playerProps.durationInFrames}
              compositionWidth={playerProps.compositionWidth}
              compositionHeight={playerProps.compositionHeight}
              style={{
                height: "calc(100vh - 14rem - 3.5rem)",
                aspectRatio: `${playerProps.compositionWidth} / ${playerProps.compositionHeight}`,
              }}
              controls
              loop
            />
          </div>
        </div>

        {/* Properties */}
        <aside className="w-[320px] shrink-0 border-l border-rule overflow-y-auto p-3">
          <div className="text-xs font-medium text-ink/80 mb-3 px-1">Properties</div>
          <PropertyPanel layer={selectedLayer} onPatch={patchLayer} />
        </aside>
      </div>

      {/* Bottom: layers + timeline */}
      <div className="h-56 shrink-0 border-t border-rule flex min-h-0">
        <div className="w-[260px] shrink-0 border-r border-rule overflow-y-auto p-2">
          <div className="text-xs font-medium text-ink/80 mb-2 px-1">Layers</div>
          <LayerTree doc={doc} selected={selected} onSelect={setSelected} />
        </div>
        <div className="flex-1 min-w-0 overflow-x-auto p-2">
          <Timeline
            doc={doc}
            fps={playerProps.fps}
            durationInFrames={playerProps.durationInFrames}
            playerRef={playerRef}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
      </div>
    </div>
  );
}
