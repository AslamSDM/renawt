"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Player } from "@remotion/player";
import { Undo2, Save, Music } from "lucide-react";
import { JitterComposition } from "@/remotion/compositions/JitterComposition";
import { AudioSelector, type AudioFile } from "@/components/audio/AudioSelector";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
}

const DEBOUNCE_MS = 600;

export function JitterEditor({ projectId, initialDoc }: Props) {
  const [doc, setDoc] = useState<JitterDoc>(initialDoc);
  const [selected, setSelected] = useState<LayerPath | null>(null);
  const [historyCount, setHistoryCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);

  const lastSavedRef = useRef<string>(JSON.stringify(initialDoc));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/jitter-doc`)
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.historyCount === "number") {
          setHistoryCount(data.historyCount);
        }
      })
      .catch(() => {});
  }, [projectId]);

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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[240px,1fr,300px] gap-4">
        {/* Left: layer tree */}
        <Card className="p-3 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-medium text-ink/80">Layers</span>
            <div className="flex items-center gap-1">
              <button
                onClick={undo}
                disabled={historyCount <= 0}
                className="p-1 rounded hover:bg-paper-2 disabled:opacity-40 disabled:cursor-not-allowed"
                title={`Undo (${historyCount} steps)`}
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <span className="text-[10px] text-muted">
                {saving ? (
                  <span className="flex items-center gap-1"><Save className="w-3 h-3" /> saving…</span>
                ) : (
                  <span>{historyCount}</span>
                )}
              </span>
            </div>
          </div>
          <LayerTree doc={doc} selected={selected} onSelect={setSelected} />
        </Card>

        {/* Center: live preview */}
        <Card className="p-3">
          <div className="rounded-lg overflow-hidden border border-rule bg-black">
            <Player
              key={playerKey}
              component={JitterComposition as any}
              inputProps={doc as any}
              fps={playerProps.fps}
              durationInFrames={playerProps.durationInFrames}
              compositionWidth={playerProps.compositionWidth}
              compositionHeight={playerProps.compositionHeight}
              style={{ width: "100%", aspectRatio: `${playerProps.compositionWidth} / ${playerProps.compositionHeight}` }}
              controls
              loop
            />
          </div>

          <div className="flex items-center justify-between mt-3 text-xs">
            <button
              onClick={() => setShowMusicPicker((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded border border-rule hover:bg-paper-2"
            >
              <Music className="w-3.5 h-3.5" />
              {currentAudio?.name ?? "Pick music"}
              {doc.audio?.bpm ? <span className="text-muted">· {doc.audio.bpm} BPM</span> : null}
            </button>
            {saveError ? <span className="text-red-400">{saveError}</span> : null}
          </div>

          {showMusicPicker ? (
            <div className="mt-3">
              <AudioSelector
                selectedAudio={currentAudio}
                onSelect={updateAudio}
              />
            </div>
          ) : null}
        </Card>

        {/* Right: properties */}
        <Card className="p-3 max-h-[70vh] overflow-y-auto">
          <div className="text-xs font-medium text-ink/80 mb-3 px-1">Properties</div>
          <PropertyPanel layer={selectedLayer} onPatch={patchLayer} />
        </Card>
      </div>
    </div>
  );
}
