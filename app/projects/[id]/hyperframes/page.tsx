"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Globe,
  Clock,
  FileVideo,
  History,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Trash2,
  Copy,
  Monitor,
  Maximize2,
  Music,
  Mic,
  Subtitles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/spinner";
import { HyperframesEditor } from "@/components/hyperframes/HyperframesEditor";
import {
  GenerationProgress,
  type ProgressEvent,
} from "@/components/hyperframes/GenerationProgress";

interface RenderResult {
  videoUrl: string;
  compositionHtml: string;
  brandReport: any;
  renderTime: number;
  music?: { title?: string; bpm?: number } | null;
  narration?: { url?: string } | null;
}

interface GenerationRow {
  id: string;
  status: "RUNNING" | "SUCCEEDED" | "FAILED" | string;
  videoUrl: string | null;
  params: any | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function sortNewestFirst(rows: GenerationRow[]): GenerationRow[] {
  const ts = (r: GenerationRow) =>
    new Date(r.finishedAt ?? r.createdAt ?? r.startedAt ?? 0).getTime();
  return [...rows].sort((a, b) => ts(b) - ts(a));
}

const DURATION_PRESETS = [
  { label: "10s", value: 10000 },
  { label: "15s", value: 15000 },
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

export default function HyperframesProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [url, setUrl] = useState("");
  const [durationMs, setDurationMs] = useState(15000);
  const [notes, setNotes] = useState("");
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [fps, setFps] = useState(30);
  const [audioUrl, setAudioUrl] = useState("");
  const [imageUrls, setImageUrls] = useState("");
  const [narrationText, setNarrationText] = useState("");
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [musicMood, setMusicMood] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [compositionHtml, setCompositionHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const [generations, setGenerations] = useState<GenerationRow[]>([]);
  const [activeGenId, setActiveGenId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressEvent[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);

  const fetchGenerations = async () => {
    try {
      const res = await fetch(`/api/projects/${id}/generations`);
      const data = await res.json();
      const rows = sortNewestFirst((data.generations ?? []) as GenerationRow[]);
      setGenerations(rows);
      return rows;
    } catch {
      return [];
    }
  };

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`/api/projects/${id}`).then((r) => r.json()),
      fetch(`/api/projects/${id}/generations`).then((r) => r.json()),
    ])
      .then(([projectData, genData]) => {
        if (!alive) return;
        if (projectData?.project?.sourceUrl) setUrl(projectData.project.sourceUrl);
        if (projectData?.project?.description) setNotes(projectData.project.description);
        const rows = sortNewestFirst(
          (genData?.generations ?? []) as GenerationRow[],
        );
        setGenerations(rows);
        const latest = rows[0];
        if (latest?.status === "RUNNING") {
          setGenerating(true);
          setActiveGenId(latest.id);
        } else if (latest?.status === "SUCCEEDED" && latest.videoUrl) {
          setResult({
            videoUrl: latest.videoUrl,
            compositionHtml: latest.params?.compositionHtml ?? "",
            brandReport: latest.params?.brandReport ?? null,
            renderTime: latest.params?.renderTime ?? 0,
          });
        }
      })
      .catch(() => {})
      .finally(() => alive && setHydrating(false));
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!generating || !activeGenId) return;
    let alive = true;
    const pull = async () => {
      try {
        const res = await fetch(`/api/projects/${id}/generations/${activeGenId}`);
        if (!res.ok) return;
        const data = await res.json();
        const evts = (data?.generation?.progress ?? []) as ProgressEvent[];
        if (alive && Array.isArray(evts)) setProgress(evts);
      } catch {}
    };
    pull();
    const t = setInterval(pull, 1500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [generating, activeGenId, id]);

  useEffect(() => {
    if (!generating) return;
    const t = setInterval(async () => {
      const rows = await fetchGenerations();
      const active = activeGenId
        ? rows.find((r) => r.id === activeGenId)
        : rows[0];
      if (!active) return;
      if (active.status === "SUCCEEDED" && active.videoUrl) {
        await loadGeneration(active.id);
        setGenerating(false);
      } else if (active.status === "FAILED") {
        setGenerating(false);
        setError(active.error || "Generation failed");
      }
    }, 4000);
    return () => clearInterval(t);
  }, [generating, activeGenId, id]);

  const loadGeneration = async (gid: string) => {
    try {
      const res = await fetch(`/api/projects/${id}/generations/${gid}`);
      const data = await res.json();
      const g = data?.generation;
      if (!g) return;
      if (g.videoUrl) {
        setResult({
          videoUrl: g.videoUrl,
          compositionHtml: g.params?.compositionHtml ?? "",
          brandReport: g.brandReport,
          renderTime: g.params?.renderTime ?? 0,
        });
        if (g.params?.compositionHtml) {
          setCompositionHtml(g.params.compositionHtml);
        }
      }
    } catch {}
  };

  const reuseInputs = (p: any) => {
    if (!p) return;
    if (typeof p.url === "string") setUrl(p.url);
    if (typeof p.durationMs === "number") setDurationMs(p.durationMs);
    setNotes(typeof p.notes === "string" ? p.notes : "");
    if (typeof p.width === "number") setWidth(p.width);
    if (typeof p.height === "number") setHeight(p.height);
    if (typeof p.fps === "number") setFps(p.fps);
    if (typeof p.audioUrl === "string") setAudioUrl(p.audioUrl);
    if (typeof p.musicMood === "string") setMusicMood(p.musicMood);
    if (typeof p.narrationText === "string") setNarrationText(p.narrationText);
    if (typeof p.captionsEnabled === "boolean") setCaptionsEnabled(p.captionsEnabled);
    if (Array.isArray(p.imageUrls)) setImageUrls(p.imageUrls.join(", "));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteGeneration = async (gid: string) => {
    if (!confirm("Delete this generation?")) return;
    await fetch(`/api/projects/${id}/generations/${gid}`, { method: "DELETE" });
    await fetchGenerations();
  };

  const generate = async (existingCompositionHtml?: string) => {
    if (!url.trim()) {
      setError("Enter a URL");
      return;
    }
    setError(null);
    setVideoError(null);
    setResult(null);
    setProgress([]);
    setGenerating(true);

    const imgs = imageUrls
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const params: Record<string, unknown> = {
      url: url.trim(),
      durationMs,
      notes: notes.trim() || undefined,
      width,
      height,
      fps,
      audioUrl: audioUrl.trim() || undefined,
      imageUrls: imgs.length > 0 ? imgs : undefined,
      musicMood: musicMood.trim() || undefined,
      narration: narrationText.trim()
        ? { text: narrationText.trim() }
        : undefined,
      captions: captionsEnabled ? { enabled: true } : undefined,
    };

    if (existingCompositionHtml) {
      params.compositionHtml = existingCompositionHtml;
    }

    let gid: string | null = null;
    try {
      const genResp = await fetch(`/api/projects/${id}/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params }),
      });
      const genData = await genResp.json();
      if (!genResp.ok || !genData?.generation?.id) {
        throw new Error(genData?.error || "Failed to create generation row");
      }
      gid = genData.generation.id;
      setActiveGenId(gid);
      await fetchGenerations();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setGenerating(false);
      return;
    }

    try {
      const token = await getVpsToken();
      if (!token) {
        throw new Error("Authentication failed. Please sign in.");
      }

      const callbackUrl = `${window.location.origin}/api/projects/${id}/generations/${gid}`;

      const resp = await fetch(`${VPS_API_URL}/api/creative/hyperframes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...params,
          projectId: id,
          async: true,
          generationId: gid,
          callbackUrl,
        }),
      });
      if (resp.status !== 202 && !resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to start generation");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setGenerating(false);
      if (gid) {
        await fetch(`/api/projects/${id}/generations/${gid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "FAILED", error: msg }),
        }).catch(() => {});
      }
      await fetchGenerations();
    }
  };

  const inputChips = (p: any): string[] => {
    if (!p) return [];
    const chips: string[] = [];
    if (typeof p.durationMs === "number") chips.push(`${p.durationMs / 1000}s`);
    if (p.width && p.height) chips.push(`${p.width}x${p.height}`);
    if (p.fps) chips.push(`${p.fps}fps`);
    return chips;
  };

  const formatRelative = (iso: string) => {
    const d = new Date(iso).getTime();
    const diff = Date.now() - d;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(iso).toLocaleDateString();
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
              <span className="mono-tick" style={{ color: "var(--ink)" }}>HYPERFRAMES · URL → VIDEO</span>
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm md:text-base font-medium tracking-[-0.02em]">HyperFrames Video</h1>
              <p className="hidden sm:block text-xs text-muted mt-0.5 truncate">
                Capture a URL, compose in HTML, render a video.
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
                placeholder="https://example.com"
                className="w-full px-4 py-3 bg-paper-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong transition-colors text-ink placeholder-gray-600"
              />
              <p className="mt-2 text-xs text-muted">
                HyperFrames will capture this URL and compose an HTML animation from its content.
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
            </Card>

            <Card className="p-5 md:p-6">
              <label className="block text-sm font-medium text-ink/80 mb-2">
                <Maximize2 className="w-4 h-4 inline mr-2" />
                Dimensions
              </label>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-[11px] text-muted mb-1">Width</label>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    min={320}
                    max={7680}
                    className="w-full px-3 py-2 bg-paper-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong transition-colors text-ink"
                  />
                </div>
                <span className="text-muted pb-2">×</span>
                <div className="flex-1">
                  <label className="block text-[11px] text-muted mb-1">Height</label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    min={320}
                    max={7680}
                    className="w-full px-3 py-2 bg-paper-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong transition-colors text-ink"
                  />
                </div>
                <div className="w-20">
                  <label className="block text-[11px] text-muted mb-1">FPS</label>
                  <input
                    type="number"
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    min={12}
                    max={120}
                    className="w-full px-3 py-2 bg-paper-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong transition-colors text-ink"
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                Defaults to 1920×1080 at 30fps.
              </p>
            </Card>

            <Card className="p-5 md:p-6">
              <label className="block text-sm font-medium text-ink/80 mb-2">
                Direction Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Use a dark theme with gradient backgrounds. Emphasize the hero section."
                className="w-full px-4 py-3 bg-paper-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong transition-colors text-ink placeholder-gray-600 resize-none"
              />
            </Card>

            <Card className="p-5 md:p-6">
              <label className="block text-sm font-medium text-ink/80 mb-2">
                Audio URL (optional)
              </label>
              <input
                type="url"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="https://example.com/bg-music.mp3"
                className="w-full px-4 py-3 bg-paper-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong transition-colors text-ink placeholder-gray-600"
              />
              <p className="mt-2 text-xs text-muted">
                Background music or voiceover will be mixed into the rendered video.
              </p>
            </Card>

            <Card className="p-5 md:p-6">
              <label className="block text-sm font-medium text-ink/80 mb-2">
                Image URLs (optional, comma-separated)
              </label>
              <input
                type="text"
                value={imageUrls}
                onChange={(e) => setImageUrls(e.target.value)}
                placeholder="https://example.com/logo.png, https://example.com/hero.jpg"
                className="w-full px-4 py-3 bg-paper-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong transition-colors text-ink placeholder-gray-600"
              />
              <p className="mt-2 text-xs text-muted">
                Images will be passed to the AI composer so it can embed them in the video composition.
              </p>
            </Card>

            <Card className="p-5 md:p-6">
              <label className="block text-sm font-medium text-ink/80 mb-2">
                <Music className="w-4 h-4 inline mr-2" />
                Music Mood (optional)
              </label>
              <input
                type="text"
                value={musicMood}
                onChange={(e) => setMusicMood(e.target.value)}
                placeholder="e.g. energetic, calm, techy, premium"
                className="w-full px-4 py-3 bg-paper-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong transition-colors text-ink placeholder-gray-600"
              />
              <p className="mt-2 text-xs text-muted">
                Override the auto-detected music mood. Leave empty to derive from brand analysis.
              </p>
            </Card>

            <Card className="p-5 md:p-6">
              <label className="block text-sm font-medium text-ink/80 mb-2">
                <Mic className="w-4 h-4 inline mr-2" />
                Narration / Voiceover (optional)
              </label>
              <textarea
                value={narrationText}
                onChange={(e) => setNarrationText(e.target.value)}
                rows={3}
                placeholder="e.g. Baro is the smartest way to manage your team's expenses. Automated receipts, instant approvals, and real-time reporting."
                className="w-full px-4 py-3 bg-paper-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong transition-colors text-ink placeholder-gray-600 resize-none"
              />
              <p className="mt-2 text-xs text-muted">
                Text will be synthesized to speech and mixed into the video. Captions are auto-generated when narration is provided.
              </p>
            </Card>

            <Card className="p-5 md:p-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <Subtitles className="w-4 h-4 text-ink/80" />
                <span className="text-sm font-medium text-ink/80">Captions</span>
                <div
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    captionsEnabled ? "bg-ink" : "bg-paper-3 border border-rule"
                  }`}
                  onClick={() => setCaptionsEnabled(!captionsEnabled)}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      captionsEnabled ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </label>
              <p className="mt-2 text-xs text-muted">
                Auto-generate captions from narration text. Requires narration to be provided.
              </p>
            </Card>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => generate()}
                disabled={generating || !url.trim()}
                size="lg"
                className="rounded-lg flex-1"
              >
                {generating ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Generating… (capture + compose + render)
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate
                  </>
                )}
              </Button>
            </div>

            {result?.compositionHtml ? (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => generate(result.compositionHtml)}
                  disabled={generating}
                  variant="outline"
                  size="sm"
                  className="rounded-lg flex-1"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Re-render with same composition
                </Button>
              </div>
            ) : null}

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
                <div className="rounded-lg bg-paper-2 border border-dashed border-rule p-4">
                  {progress.length ? (
                    <GenerationProgress events={progress} running />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-10">
                      <Spinner size="lg" />
                      <span className="text-xs text-muted">
                        Starting pipeline…
                      </span>
                    </div>
                  )}
                </div>
              ) : result ? (
                <div className="space-y-4">
                  {result.videoUrl?.trim() ? (
                    <video
                      key={result.videoUrl}
                      src={result.videoUrl}
                      controls
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="metadata"
                      className="w-full rounded-lg border border-rule bg-black aspect-video object-contain"
                      onError={() => setVideoError(result.videoUrl)}
                    />
                  ) : (
                    <div className="aspect-video rounded-lg border border-rule bg-paper-2 flex items-center justify-center text-xs text-muted">
                      Render finished but no video URL was returned.
                    </div>
                  )}
                  {videoError && videoError === result.videoUrl ? (
                    <div className="text-[11px] text-amber-300">
                      Inline playback failed.{" "}
                      <a
                        href={result.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Open the mp4 in a new tab
                      </a>
                      .
                    </div>
                  ) : null}
                  <div className="text-xs text-muted space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted">Brand</span>
                      <span>{result.brandReport?.productName ?? "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Music</span>
                      <span>{result.music?.title ?? "auto-picked"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Narration</span>
                      <span>{result.narration?.url ? "yes" : "no"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Render time</span>
                      <span>{result.renderTime ? `${result.renderTime.toFixed(1)}s` : "—"}</span>
                    </div>
                  </div>

                  {result.compositionHtml ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-ink/80">
                          <Monitor className="w-3.5 h-3.5 inline mr-1.5" />
                          Composition HTML
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(result.compositionHtml);
                          }}
                          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-rule hover:border-rule-strong transition-colors"
                          title="Copy composition HTML"
                        >
                          <Copy className="w-3 h-3" />
                          Copy
                        </button>
                      </div>
                      <pre className="max-h-48 overflow-auto rounded-md bg-paper-2 border border-rule p-3 text-[11px] leading-relaxed text-ink/80 whitespace-pre-wrap break-words font-mono">
                        {result.compositionHtml}
                      </pre>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditorOpen(true)}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 bg-ink text-paper hover:opacity-90 rounded-lg text-sm font-medium transition-opacity"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      Preview
                    </button>
                    <a
                      href={result.videoUrl}
                      download
                      className="flex items-center justify-center px-4 py-2 bg-paper-2 hover:bg-paper-3 rounded-lg text-sm border border-rule transition-colors"
                    >
                      Download mp4
                    </a>
                  </div>
                </div>
              ) : (
                <div className="aspect-video bg-paper-2 rounded-lg flex flex-col items-center justify-center gap-2 border border-dashed border-rule text-center px-4">
                  {hydrating ? (
                    <span className="text-xs text-muted">Loading…</span>
                  ) : (
                    <>
                      <FileVideo className="w-6 h-6 text-muted/60" />
                      <span className="text-xs text-muted">
                        No renders yet
                      </span>
                      <span className="text-[11px] text-muted/70">
                        Hit Generate to create your first render — it&apos;ll
                        show up here.
                      </span>
                    </>
                  )}
                </div>
              )}
            </Card>
          </aside>
        </section>

        <HyperframesEditor
          projectId={id}
          compositionHtml={result?.compositionHtml ?? compositionHtml}
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
        />

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium tracking-tight flex items-center gap-2">
              <History className="w-4 h-4" />
              Generations
              <span className="text-xs text-muted">({generations.length})</span>
            </h2>
          </div>

          {generations.length === 0 ? (
            <Card className="p-8 text-center">
              <span className="text-xs text-muted">
                No generations yet. Hit Generate to create the first render.
              </span>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {generations.map((g) => {
                const isActive = activeGenId === g.id;
                const running = g.status === "RUNNING";
                const failed = g.status === "FAILED";
                return (
                  <Card
                    key={g.id}
                    className={`p-3 transition-colors ${
                      isActive ? "border-rule-strong" : ""
                    }`}
                  >
                    <div
                      className="relative aspect-video rounded-md overflow-hidden bg-paper-2 border border-rule cursor-pointer"
                      onClick={() => !running && g.videoUrl && loadGeneration(g.id)}
                    >
                      {g.videoUrl ? (
                        <video
                          src={g.videoUrl}
                          muted
                          playsInline
                          preload="metadata"
                          className="absolute inset-0 h-full w-full object-cover"
                          onMouseEnter={(e) => {
                            const v = e.currentTarget;
                            v.currentTime = 0;
                            v.play().catch(() => {});
                          }}
                          onMouseLeave={(e) => e.currentTarget.pause()}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          {running ? (
                            <Loader2 className="w-6 h-6 animate-spin text-muted" />
                          ) : failed ? (
                            <AlertCircle className="w-6 h-6 text-red-400" />
                          ) : (
                            <FileVideo className="w-6 h-6 text-muted" />
                          )}
                        </div>
                      )}
                      {running ? (
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ background: "rgba(7,7,10,0.55)" }}
                        >
                          <div className="flex flex-col items-center gap-1.5">
                            <Loader2 className="w-5 h-5 animate-spin text-ink" />
                            <span className="mono-tick text-[10px]">RUNNING</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[11px] text-muted">
                        {g.status === "SUCCEEDED" ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : failed ? (
                          <AlertCircle className="w-3 h-3 text-red-400" />
                        ) : (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                        {g.status}
                      </span>
                      <span className="text-[11px] text-muted">
                        {formatRelative(g.createdAt)}
                      </span>
                    </div>
                    {g.params?.url ? (
                      <div className="mt-1 text-[11px] truncate text-muted">
                        {g.params.url}
                      </div>
                    ) : null}
                    {inputChips(g.params).length ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {inputChips(g.params).map((c, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded bg-paper-2 border border-rule text-[10px] text-muted whitespace-nowrap"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {g.params?.notes ? (
                      <div className="mt-1 text-[11px] text-muted/80 line-clamp-2">
                        {g.params.notes}
                      </div>
                    ) : null}
                    {failed && g.error ? (
                      <div className="mt-1 text-[11px] text-red-300 line-clamp-2">
                        {g.error}
                      </div>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={running || !g.videoUrl}
                          onClick={() => loadGeneration(g.id).then(() => setEditorOpen(true))}
                          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-rule hover:border-rule-strong disabled:opacity-40"
                        >
                          <Monitor className="w-3 h-3" />
                          Preview
                        </button>
                        <button
                          type="button"
                          disabled={!g.params}
                          onClick={() => reuseInputs(g.params)}
                          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-rule hover:border-rule-strong disabled:opacity-40"
                          title="Load these inputs into the form"
                        >
                          <History className="w-3 h-3" />
                          Reuse
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteGeneration(g.id)}
                        className="p-1.5 rounded hover:bg-paper-3 text-muted hover:text-red-300"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
