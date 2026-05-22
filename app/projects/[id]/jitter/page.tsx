"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, Globe, Clock, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/spinner";
import { AudioSelector, AudioFile } from "@/components/audio/AudioSelector";
import { JitterEditor } from "@/components/jitter/JitterEditor";
import type { JitterDoc } from "@/components/jitter/types";

interface RenderResult {
  videoUrl: string;
  brandReport: any;
  music: { title: string; bpm: number } | null;
  jitterDoc: JitterDoc;
  doc: {
    artboards: number;
    operations: number;
    customComponents: number;
    durationMs: number;
  };
}

const DURATION_PRESETS = [
  { label: "10s", value: 10000 },
  { label: "16s", value: 16000 },
  { label: "20s", value: 20000 },
  { label: "30s", value: 30000 },
];

const VPS_API_URL = process.env.NEXT_PUBLIC_API_URL || "";

async function getVpsToken(): Promise<string | null> {
  const res = await fetch("/api/auth/vps-token");
  if (!res.ok) return null;
  const data = await res.json();
  return data.token || null;
}

export default function JitterProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [url, setUrl] = useState("");
  const [selectedAudio, setSelectedAudio] = useState<AudioFile | null>(null);
  const [durationMs, setDurationMs] = useState(16000);
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [savedDoc, setSavedDoc] = useState<JitterDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`/api/projects/${id}`).then((r) => r.json()),
      fetch(`/api/projects/${id}/jitter-doc`).then((r) => r.json()),
    ])
      .then(([projectData, docData]) => {
        if (!alive) return;
        if (projectData?.project?.sourceUrl) setUrl(projectData.project.sourceUrl);
        if (projectData?.project?.description) setNotes(projectData.project.description);
        if (docData?.doc) setSavedDoc(docData.doc as JitterDoc);
      })
      .catch(() => {})
      .finally(() => alive && setHydrating(false));
    return () => {
      alive = false;
    };
  }, [id]);

  const persistInitialDoc = async (doc: JitterDoc) => {
    try {
      await fetch(`/api/projects/${id}/jitter-doc`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc, label: "generate" }),
      });
    } catch {}
  };

  const generate = async () => {
    if (!url.trim()) {
      setError("Enter a URL");
      return;
    }
    setError(null);
    setResult(null);
    setGenerating(true);
    try {
      const token = await getVpsToken();
      if (!token) {
        throw new Error("Authentication failed. Please sign in.");
      }
      const audio = selectedAudio
        ? {
            url: selectedAudio.url,
            bpm: selectedAudio.bpm ?? 124,
            volume: 0.6,
            title: selectedAudio.name,
          }
        : undefined;

      const resp = await fetch(`${VPS_API_URL}/api/creative/jitter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: url.trim(),
          audio,
          durationMs,
          notes: notes.trim() || undefined,
          projectId: id,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || "Generation failed");
      }
      setResult(data);
      if (data.jitterDoc) {
        setSavedDoc(data.jitterDoc);
        await persistInitialDoc(data.jitterDoc);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface text-ink">
      <div className="pointer-events-none absolute inset-0 kinetic-dotgrid" />
      <div
        className="pointer-events-none absolute kinetic-glow-soft"
        style={{ top: -150, left: "50%", transform: "translateX(-50%)", width: 1000, height: 500 }}
      />

      <header
        className="relative z-10 sticky top-0 backdrop-blur-md"
        style={{ background: "rgba(7,7,10,0.7)", borderBottom: "1px solid var(--rule)" }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 md:px-6 md:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
            <Link
              href="/projects"
              className="shrink-0 p-2 hover:bg-paper-2 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="hidden sm:inline-flex kinetic-pill !py-1 !px-2.5">
              <span className="accent-dot" />
              <span className="mono-tick" style={{ color: "var(--ink)" }}>JITTER · URL → VIDEO</span>
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm md:text-base font-medium tracking-[-0.02em]">Generate from URL</h1>
              <p className="hidden sm:block text-xs text-muted mt-0.5 truncate">
                Screenshot the page, derive the brand, render an animated video.
              </p>
              <p className="sm:hidden text-[11px] text-muted mt-0.5">
                URL → animated video
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6 md:px-6 md:py-8 space-y-6 md:space-y-8">
        <section className="grid grid-cols-1 lg:grid-cols-[1fr,420px] gap-5 md:gap-8">
          {/* Left: form */}
          <div className="space-y-6">
            <Card className="p-5 md:p-6">
              <label className="block text-sm font-medium text-ink/80 mb-2">
                <Globe className="w-4 h-4 inline mr-2" />
                Source URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.apple.com/in/macbook-neo/"
                className="w-full px-4 py-3 bg-paper-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong transition-colors text-ink placeholder-gray-600"
              />
              <p className="mt-2 text-xs text-muted">
                Headless screenshot + Gemini Vision will pull brand colors, copy, and hero asset.
              </p>
            </Card>

            <Card className="p-5 md:p-6">
              <label className="block text-sm font-medium text-ink/80 mb-3">
                <Clock className="w-4 h-4 inline mr-2" />
                Duration
              </label>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setDurationMs(p.value)}
                    className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                      durationMs === p.value
                        ? "bg-ink text-ink-inverse border-ink"
                        : "bg-transparent text-ink/80 border-rule hover:border-rule-strong"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">
                Auto-aligned to whole beats based on the chosen track's BPM.
              </p>
            </Card>

            <Card className="p-5 md:p-6">
              <label className="block text-sm font-medium text-ink/80 mb-2">
                Direction (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Apple-grade minimal aesthetic. Use MacMockup with hero screenshot and a CursorClick on the Buy CTA."
                className="w-full px-4 py-3 bg-paper-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong transition-colors text-ink placeholder-gray-600 resize-none"
              />
            </Card>

            <AudioSelector
              selectedAudio={selectedAudio}
              onSelect={setSelectedAudio}
            />
            <p className="-mt-3 text-xs text-muted">
              Leave empty to auto-pick a track that matches the brand mood. The
              chosen track's BPM drives the beat grid.
            </p>

            <div className="flex items-center gap-3">
              <Button
                onClick={generate}
                disabled={generating || !url.trim()}
                size="lg"
                className="rounded-lg flex-1"
              >
                {generating ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Generating… (vision + composer + render)
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    {savedDoc ? "Re-generate" : "Generate"}
                  </>
                )}
              </Button>
            </div>

            {error ? (
              <div className="p-4 border border-red-500/30 bg-red-500/10 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            ) : null}
          </div>

          {/* Right: render output panel */}
          <aside className="space-y-4">
            <Card className="p-5 md:p-6 lg:sticky lg:top-6">
              <div className="flex items-center gap-2 text-sm font-medium text-ink/80 mb-4">
                <FileVideo className="w-4 h-4" />
                Last render
              </div>

              {generating && !result ? (
                <div className="aspect-video bg-paper-2 rounded-lg flex flex-col items-center justify-center gap-3 border border-dashed border-rule">
                  <Spinner size="lg" />
                  <span className="text-xs text-muted">
                    Capturing → analyzing → composing → rendering
                  </span>
                </div>
              ) : result ? (
                <div className="space-y-4">
                  <video
                    src={result.videoUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full rounded-lg border border-rule"
                  />
                  <div className="text-xs text-muted space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted">Brand</span>
                      <span>{result.brandReport?.productName ?? "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Music</span>
                      <span>
                        {result.music
                          ? `${result.music.title} @ ${result.music.bpm} BPM`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Artboards / ops</span>
                      <span>
                        {result.doc.artboards} / {result.doc.operations}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Custom components</span>
                      <span>{result.doc.customComponents}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Duration</span>
                      <span>{(result.doc.durationMs / 1000).toFixed(2)}s</span>
                    </div>
                  </div>
                  <a
                    href={result.videoUrl}
                    download
                    className="block text-center px-4 py-2 bg-paper-2 hover:bg-paper-3 rounded-lg text-sm border border-rule transition-colors"
                  >
                    Download mp4
                  </a>
                </div>
              ) : (
                <div className="aspect-video bg-paper-2 rounded-lg flex items-center justify-center border border-dashed border-rule">
                  <span className="text-xs text-muted">
                    {hydrating ? "Loading…" : "Output will appear here"}
                  </span>
                </div>
              )}
            </Card>
          </aside>
        </section>

        {savedDoc ? (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium tracking-tight">Editor</h2>
              <span className="text-xs text-muted">
                Live preview · edits autosave · undo restores prior version
              </span>
            </div>
            <JitterEditor projectId={id} initialDoc={savedDoc} />
          </section>
        ) : null}
      </main>
    </div>
  );
}
