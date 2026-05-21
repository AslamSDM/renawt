"use client";

import React, { useState, useEffect, useCallback, useRef, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Globe,
  Clock,
  FileVideo,
  ListVideo,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/spinner";
import { AudioSelector, AudioFile } from "@/components/audio/AudioSelector";
import { JitterEditor } from "@/components/jitter/JitterEditor";
import type { JitterDoc } from "@/components/jitter/types";

interface JobSummary {
  id: string;
  projectId: string | null;
  status: "queued" | "running" | "completed" | "failed";
  phase: "capturing" | "composing" | "rendering" | null;
  url: string;
  durationMs: number;
  error: string | null;
  videoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface JobDetail extends JobSummary {
  brandReport: any;
  music: { title: string; bpm: number } | null;
  jitterDoc: JitterDoc | null;
  doc: {
    artboards: number;
    operations: number;
    customComponents: number;
    durationMs: number;
  } | null;
}

const DURATION_PRESETS = [
  { label: "10s", value: 10000 },
  { label: "16s", value: 16000 },
  { label: "20s", value: 20000 },
  { label: "30s", value: 30000 },
];

const VPS_API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const POLL_MS = 2500;

async function getVpsToken(): Promise<string | null> {
  const res = await fetch("/api/auth/vps-token");
  if (!res.ok) return null;
  const data = await res.json();
  return data.token || null;
}

function phaseLabel(j: JobSummary): string {
  if (j.status === "completed") return "Done";
  if (j.status === "failed") return "Failed";
  if (j.status === "queued") return "Queued";
  switch (j.phase) {
    case "capturing":
      return "Capturing screenshot";
    case "composing":
      return "Composing scenes";
    case "rendering":
      return "Rendering video";
    default:
      return "Running";
  }
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
  const [submitting, setSubmitting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<JobDetail | null>(null);
  const [queue, setQueue] = useState<JobSummary[]>([]);
  const [savedDoc, setSavedDoc] = useState<JitterDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(true);

  const tokenRef = useRef<string | null>(null);
  const getToken = useCallback(async () => {
    if (tokenRef.current) return tokenRef.current;
    const t = await getVpsToken();
    tokenRef.current = t;
    return t;
  }, []);

  // Initial hydrate: project + saved doc + queue.
  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`/api/projects/${id}`).then((r) => r.json()),
      fetch(`/api/projects/${id}/jitter-doc`).then((r) => r.json()),
    ])
      .then(([projectData, docData]) => {
        if (!alive) return;
        if (projectData?.project?.sourceUrl)
          setUrl(projectData.project.sourceUrl);
        if (projectData?.project?.description)
          setNotes(projectData.project.description);
        if (docData?.doc) setSavedDoc(docData.doc as JitterDoc);
      })
      .catch(() => {})
      .finally(() => alive && setHydrating(false));
    return () => {
      alive = false;
    };
  }, [id]);

  // Poll the user's recent jobs (queue panel).
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const token = await getToken();
        if (!token || !alive) return;
        const res = await fetch(`${VPS_API_URL}/api/creative/jitter/jobs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || !alive) return;
        const data = await res.json();
        if (alive && Array.isArray(data?.jobs)) {
          setQueue(data.jobs);
          // If we don't have an active job yet, latch onto the newest
          // non-terminal one (e.g. user reloaded mid-render).
          if (!activeJobId) {
            const live = data.jobs.find(
              (j: JobSummary) =>
                j.status === "queued" || j.status === "running",
            );
            if (live) setActiveJobId(live.id);
          }
        }
      } catch {}
      if (alive) {
        const hasLive = queue.some(
          (j) => j.status === "queued" || j.status === "running",
        );
        timer = setTimeout(tick, hasLive || activeJobId ? POLL_MS : 8000);
      }
    };

    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken, activeJobId]);

  // Poll the active job for details (phase + final result).
  useEffect(() => {
    if (!activeJobId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const token = await getToken();
        if (!token || !alive) return;
        const res = await fetch(
          `${VPS_API_URL}/api/creative/jitter/jobs/${activeJobId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok || !alive) return;
        const data: JobDetail = await res.json();
        if (!alive) return;
        setActiveJob(data);

        if (data.status === "completed") {
          if (data.jitterDoc) {
            setSavedDoc(data.jitterDoc);
            // Persist new doc once.
            fetch(`/api/projects/${id}/jitter-doc`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ doc: data.jitterDoc, label: "generate" }),
            }).catch(() => {});
          }
          return; // stop polling
        }
        if (data.status === "failed") {
          setError(data.error || "Generation failed");
          return;
        }
      } catch {}
      if (alive) timer = setTimeout(tick, POLL_MS);
    };

    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [activeJobId, id, getToken]);

  const generate = async () => {
    if (!url.trim()) {
      setError("Enter a URL");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Authentication failed. Please sign in.");

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
      if (!resp.ok) throw new Error(data?.error || "Failed to enqueue");

      setActiveJobId(data.jobId);
      setActiveJob(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isLive =
    activeJob?.status === "queued" || activeJob?.status === "running";

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface text-ink">
      <div className="pointer-events-none absolute inset-0 kinetic-dotgrid" />
      <div
        className="pointer-events-none absolute kinetic-glow-soft"
        style={{
          top: -150,
          left: "50%",
          transform: "translateX(-50%)",
          width: 1000,
          height: 500,
        }}
      />

      <header
        className="relative z-10 sticky top-0 backdrop-blur-md"
        style={{
          background: "rgba(7,7,10,0.7)",
          borderBottom: "1px solid var(--rule)",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/projects"
              className="p-2 hover:bg-paper-2 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="kinetic-pill !py-1 !px-2.5">
              <span className="accent-dot" />
              <span className="mono-tick" style={{ color: "var(--ink)" }}>
                JITTER · URL → VIDEO
              </span>
            </span>
            <div>
              <h1 className="text-base font-medium tracking-[-0.02em]">
                Generate from URL
              </h1>
              <p className="text-xs text-muted mt-0.5">
                Screenshot the page, derive the brand, render an animated video.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section className="grid grid-cols-1 lg:grid-cols-[1fr,420px] gap-8">
          {/* Left: form */}
          <div className="space-y-6">
            <Card className="p-6">
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
                Headless screenshot + Gemini Vision will pull brand colors,
                copy, and hero asset.
              </p>
            </Card>

            <Card className="p-6">
              <label className="block text-sm font-medium text-ink/80 mb-3">
                <Clock className="w-4 h-4 inline mr-2" />
                Duration
              </label>
              <div className="flex gap-2">
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
                Auto-aligned to whole beats based on the chosen track&apos;s
                BPM.
              </p>
            </Card>

            <Card className="p-6">
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
              chosen track&apos;s BPM drives the beat grid.
            </p>

            <div className="flex items-center gap-3">
              <Button
                onClick={generate}
                disabled={submitting || isLive || !url.trim()}
                size="lg"
                className="rounded-lg flex-1"
              >
                {submitting ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Enqueuing…
                  </>
                ) : isLive ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {phaseLabel(activeJob as JobSummary)}…
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

          {/* Right: render output + queue panel */}
          <aside className="space-y-4">
            <Card className="p-6 sticky top-6">
              <div className="flex items-center gap-2 text-sm font-medium text-ink/80 mb-4">
                <FileVideo className="w-4 h-4" />
                {activeJob?.status === "completed"
                  ? "Latest render"
                  : "Current job"}
              </div>

              {isLive ? (
                <div className="aspect-video bg-paper-2 rounded-lg flex flex-col items-center justify-center gap-3 border border-dashed border-rule">
                  <Spinner size="lg" />
                  <span className="text-xs text-muted">
                    {phaseLabel(activeJob as JobSummary)}…
                  </span>
                </div>
              ) : activeJob?.status === "completed" && activeJob.videoUrl ? (
                <div className="space-y-4">
                  <video
                    src={activeJob.videoUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full rounded-lg border border-rule"
                  />
                  <div className="text-xs text-muted space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted">Brand</span>
                      <span>
                        {activeJob.brandReport?.productName ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Music</span>
                      <span>
                        {activeJob.music
                          ? `${activeJob.music.title} @ ${activeJob.music.bpm} BPM`
                          : "—"}
                      </span>
                    </div>
                    {activeJob.doc ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted">Artboards / ops</span>
                          <span>
                            {activeJob.doc.artboards} /{" "}
                            {activeJob.doc.operations}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted">Duration</span>
                          <span>
                            {(activeJob.doc.durationMs / 1000).toFixed(2)}s
                          </span>
                        </div>
                      </>
                    ) : null}
                  </div>
                  <a
                    href={activeJob.videoUrl}
                    download
                    className="block text-center px-4 py-2 bg-paper-2 hover:bg-paper-3 rounded-lg text-sm border border-rule transition-colors"
                  >
                    Download mp4
                  </a>
                </div>
              ) : activeJob?.status === "failed" ? (
                <div className="aspect-video bg-paper-2 rounded-lg flex flex-col items-center justify-center gap-3 border border-dashed border-red-500/40 p-4 text-center">
                  <XCircle className="w-6 h-6 text-red-400" />
                  <span className="text-xs text-red-300">
                    {activeJob.error || "Job failed"}
                  </span>
                </div>
              ) : (
                <div className="aspect-video bg-paper-2 rounded-lg flex items-center justify-center border border-dashed border-rule">
                  <span className="text-xs text-muted">
                    {hydrating ? "Loading…" : "Output will appear here"}
                  </span>
                </div>
              )}
            </Card>

            {queue.length > 0 ? (
              <Card className="p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-ink/80 mb-3">
                  <ListVideo className="w-4 h-4" />
                  Queue · {queue.length}
                </div>
                <ul className="space-y-2 max-h-[320px] overflow-y-auto">
                  {queue.map((j) => {
                    const isActive = j.id === activeJobId;
                    const Icon =
                      j.status === "completed"
                        ? CheckCircle2
                        : j.status === "failed"
                        ? XCircle
                        : Loader2;
                    const iconClass =
                      j.status === "completed"
                        ? "text-emerald-400"
                        : j.status === "failed"
                        ? "text-red-400"
                        : "text-ink/70 animate-spin";
                    return (
                      <li key={j.id}>
                        <button
                          onClick={() => setActiveJobId(j.id)}
                          className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                            isActive
                              ? "border-rule-strong bg-paper-2"
                              : "border-rule hover:bg-paper-2"
                          }`}
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
                            <span className="font-medium">
                              {phaseLabel(j)}
                            </span>
                            <span className="ml-auto text-muted">
                              {new Date(j.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="mt-1 truncate text-[11px] text-muted">
                            {j.url}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ) : null}
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
