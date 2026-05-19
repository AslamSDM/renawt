"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  ArrowUpRight,
  ArrowRight,
  Music2,
  Layers,
  Upload,
  Command,
  Loader2,
} from "lucide-react";

const PENDING_PROMPT_KEY = "remawt:pending-prompt";
const ASPECTS = ["16:9", "9:16", "1:1"] as const;
type Aspect = (typeof ASPECTS)[number];

function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s)]+/i);
  return m ? m[0] : null;
}

interface ShowcaseItem {
  id: string;
  name: string | null;
  videoUrl: string | null;
  sourceUrl: string | null;
  updatedAt: string;
  status: string;
}

function hostnameFromUrl(u: string | null): string {
  if (!u) return "";
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const TYPING_TEXTS = [
  "product demo",
  "launch video",
  "feature drop",
  "onboarding clip",
];

const TypewriterText = () => {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const target = TYPING_TEXTS[idx];
    if (paused) {
      const t = setTimeout(() => {
        setPaused(false);
        setDeleting(true);
      }, 1800);
      return () => clearTimeout(t);
    }
    if (deleting) {
      if (text === "") {
        setDeleting(false);
        setIdx((p) => (p + 1) % TYPING_TEXTS.length);
      } else {
        const t = setTimeout(() => setText(text.slice(0, -1)), 35);
        return () => clearTimeout(t);
      }
    } else {
      if (text === target) {
        setPaused(true);
      } else {
        const t = setTimeout(
          () => setText(target.slice(0, text.length + 1)),
          70
        );
        return () => clearTimeout(t);
      }
    }
  }, [text, idx, deleting, paused]);

  return (
    <span style={{ color: "var(--accent)" }}>
      {text}
      <span className="typing-cursor ml-1 inline-block h-[0.9em] w-[3px] translate-y-1 align-middle" style={{ background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }} />
    </span>
  );
};

const LOGOS = [
  "Linear",
  "Vercel",
  "Supabase",
  "Cursor",
  "Resend",
  "Modal",
  "Statsig",
  "Arc",
];

const STEPS = [
  {
    n: "01",
    t: "Prompt",
    d: "Type what you want. The brief, the vibe, the call to action.",
    kicker: "~ 0:08s",
  },
  {
    n: "02",
    t: "Generate",
    d: "Remawt records your product, scripts the shots, scores the cuts, lays the kinetic captions.",
    kicker: "~ 3:40s",
  },
  {
    n: "03",
    t: "Ship",
    d: "4K master and 9 auto-cropped derivatives. Or jump into the editor and tweak it.",
    kicker: "~ 0:12s",
  },
];

const USE_CASES = [
  {
    code: "PROD-01",
    title: "Product demo",
    blurb: "Walk through the entire product in one cinematic cut.",
    stat: "1:24",
    label: "AVG RUNTIME",
  },
  {
    code: "LAUNCH",
    title: "Launch video",
    blurb: "Tease, hero, deep-dive — every reel for launch week.",
    stat: "4:18",
    label: "RENDER TIME",
  },
  {
    code: "DROP",
    title: "Feature drop",
    blurb: "Bite-size announcement reels for changelog, social, in-app.",
    stat: "9",
    label: "ASPECT RATIOS",
  },
  {
    code: "ONBOARD",
    title: "Onboarding clip",
    blurb: "Replace cold tooltips with a friendly host walking the first-run flow.",
    stat: "+38%",
    label: "ACTIVATION LIFT",
  },
];

const PROMPT_CHIPS = [
  { i: Command, l: "BRAND KIT" },
  { i: Music2, l: "SCORE" },
  { i: Layers, l: "TEMPLATE" },
  { i: Upload, l: "UPLOAD" },
];

interface PromptCardProps {
  prompt: string;
  setPrompt: (v: string) => void;
  aspect: Aspect;
  setAspect: (v: Aspect) => void;
  loading: boolean;
  onGenerate: () => void;
}

function PromptCard({ prompt, setPrompt, aspect, setAspect, loading, onGenerate }: PromptCardProps) {
  return (
    <div
      className="relative rounded-2xl p-5"
      style={{
        background: "var(--paper)",
        border: "1px solid var(--rule)",
        boxShadow:
          "0 0 0 1px var(--rule), 0 0 60px -10px rgba(59,130,246,0.40), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="mono-tick">NEW PROJECT · UNTITLED</span>
        <span className="flex-1" />
        {ASPECTS.map((a) => {
          const active = a === aspect;
          return (
            <button
              key={a}
              type="button"
              onClick={() => setAspect(a)}
              className="rounded-full px-2 py-0.5 font-mono text-[10.5px] transition-colors"
              style={{
                background: active ? "var(--accent-soft)" : "rgba(245,245,247,0.04)",
                color: active ? "var(--accent)" : "var(--muted)",
                border: active ? "1px solid rgba(59,130,246,0.40)" : "1px solid var(--rule)",
              }}
            >
              {a}
            </button>
          );
        })}
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !loading) {
            e.preventDefault();
            onGenerate();
          }
        }}
        rows={3}
        placeholder="Paste a product URL or describe the launch film you want. e.g. https://yoursite.com — 30s, energetic, brand-tuned."
        className="w-full resize-none bg-transparent px-1 pb-3 text-lg leading-relaxed text-ink placeholder:text-subtle focus:outline-none"
      />
      <div className="flex items-center gap-2 border-t border-rule pt-3">
        {PROMPT_CHIPS.map((c, i) => {
          const Icon = c.i;
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
              style={{ background: "rgba(245,245,247,0.04)", border: "1px solid var(--rule)" }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} strokeWidth={1.6} />
              <span className="mono-tick">{c.l}</span>
            </span>
          );
        })}
        <span className="flex-1" />
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading || !prompt.trim()}
          className="btn-accent text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...
            </>
          ) : (
            <>
              Generate <ArrowUpRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

interface MiniTimelineProps {
  bpm: number;
  durationSeconds: number;
  trackName: string;
}

function MiniTimeline({ bpm, durationSeconds, trackName }: MiniTimelineProps) {
  const [playheadPct, setPlayheadPct] = useState(0);
  const [beatPulse, setBeatPulse] = useState(0);

  useEffect(() => {
    const beatMs = 60_000 / Math.max(1, bpm);
    const totalMs = Math.max(1_000, durationSeconds * 1000);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - start) % totalMs;
      setPlayheadPct((elapsed / totalMs) * 100);
      const intoBeat = elapsed % beatMs;
      setBeatPulse(1 - intoBeat / beatMs);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bpm, durationSeconds]);

  const framesPerBeat = (60 / Math.max(1, bpm)) * 30;
  const rows = useMemo(() => {
    return [
      { l: "V1", clips: [[0, 40], [44, 70], [74, 100]], c: "rgba(245,245,247,0.20)" },
      { l: "V2", clips: [[4, 18], [28, 50], [60, 82]], c: "rgba(59,130,246,0.80)" },
      { l: "V3", clips: [[10, 16], [42, 52], [72, 90]], c: "rgba(59,130,246,0.50)" },
      { l: "A1", clips: [[0, 100]], c: "rgba(245,245,247,0.10)" },
    ];
  }, []);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between font-mono text-[9px] text-muted">
        <span className="truncate">{trackName}</span>
        <span>{bpm} BPM · {framesPerBeat.toFixed(1)} f/beat</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="mb-1 grid grid-cols-[28px_1fr] gap-2">
          <span className="self-center font-mono text-[9px] text-muted">{r.l}</span>
          <div
            className="relative h-3.5 rounded-sm"
            style={{ background: "rgba(245,245,247,0.04)" }}
          >
            {r.clips.map((c, j) => (
              <div
                key={j}
                className="absolute top-0.5 bottom-0.5 rounded-sm"
                style={{ left: `${c[0]}%`, width: `${c[1] - c[0]}%`, background: r.c }}
              />
            ))}
            {i === 1 && (
              <div
                className="absolute top-[-4px] bottom-[-4px] w-[1.5px]"
                style={{
                  left: `${playheadPct}%`,
                  background: "var(--accent)",
                  boxShadow: `0 0 ${4 + beatPulse * 14}px var(--accent)`,
                  transition: "box-shadow 60ms linear",
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const [creating, setCreating] = useState(false);
  const [showcase, setShowcase] = useState<ShowcaseItem[]>([]);
  const [sampleTrack, setSampleTrack] = useState<{
    bpm: number;
    duration: number;
    name: string;
  }>({ bpm: 120, duration: 30, name: "Sample track" });

  useEffect(() => {
    let alive = true;
    fetch("/api/showcase")
      .then((r) => r.json())
      .then((d) => {
        if (alive && Array.isArray(d.projects)) setShowcase(d.projects);
      })
      .catch(() => {});
    fetch("/api/audio")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const first = Array.isArray(d.audio) ? d.audio[0] : null;
        if (first?.bpm) {
          setSampleTrack({
            bpm: first.bpm,
            duration: first.duration || 30,
            name: first.name || "Sample track",
          });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const createFromPrompt = async (text: string, asp: Aspect) => {
    setCreating(true);
    try {
      const sourceUrl = extractUrl(text);
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Project",
          description: text,
          sourceUrl: sourceUrl || undefined,
          productData: { aspect: asp },
          status: "DRAFT",
        }),
      });
      if (res.status === 401) {
        localStorage.setItem(
          PENDING_PROMPT_KEY,
          JSON.stringify({ text, aspect: asp })
        );
        signIn("google", { callbackUrl: "/" });
        return;
      }
      const data = await res.json();
      if (data.project?.id) {
        router.push(`/projects/${data.project.id}/jitter`);
      }
    } catch (err) {
      console.error("Failed to create project", err);
    } finally {
      setCreating(false);
    }
  };

  const handleGenerate = () => {
    const text = prompt.trim();
    if (!text) return;
    if (authStatus === "loading") return;
    if (!session) {
      localStorage.setItem(
        PENDING_PROMPT_KEY,
        JSON.stringify({ text, aspect })
      );
      signIn("google", { callbackUrl: "/" });
      return;
    }
    void createFromPrompt(text, aspect);
  };

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const raw = localStorage.getItem(PENDING_PROMPT_KEY);
    if (!raw) return;
    localStorage.removeItem(PENDING_PROMPT_KEY);
    try {
      const parsed = JSON.parse(raw) as { text?: string; aspect?: Aspect };
      if (parsed.text && parsed.text.trim()) {
        setPrompt(parsed.text);
        if (parsed.aspect && ASPECTS.includes(parsed.aspect)) {
          setAspect(parsed.aspect);
        }
        void createFromPrompt(parsed.text, parsed.aspect ?? aspect);
      }
    } catch {}
  }, [authStatus]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface text-ink">
      {/* Ambient backdrop */}
      <div className="pointer-events-none absolute inset-0 kinetic-dotgrid" />
      <div
        className="pointer-events-none absolute kinetic-glow"
        style={{ top: -300, left: "50%", transform: "translateX(-50%)", width: 1400, height: 900 }}
      />

      <Navbar transparent />

      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="relative px-6 pt-32 md:pt-36">
        <div className="mx-auto max-w-[1400px] text-center">
          <div className="kinetic-pill mx-auto mb-9">
            <span className="accent-dot" />
            <span className="mono-tick" style={{ color: "var(--ink)" }}>
              NEW · v4.2 · GUIDED CINEMATOGRAPHY MODEL
            </span>
            <span className="mono-tick" style={{ color: "var(--accent)" }}>
              READ THE POST →
            </span>
          </div>

          <h1 className="text-[clamp(1.75rem,5vw,3.75rem)] font-medium leading-[1.05] tracking-[-0.035em]">
            Render the <TypewriterText />{" "}
            <span style={{ color: "var(--muted)" }}>your launch</span>{" "}
            <span style={{ color: "var(--accent)" }}>deserves.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-muted md:text-base">
            Broadcast-grade product videos from a single prompt. Cinematic by
            default. Editable when you need it.
          </p>

          {/* Prompt card */}
          <div className="mx-auto mt-12 max-w-[740px] text-left">
            <PromptCard
              prompt={prompt}
              setPrompt={setPrompt}
              aspect={aspect}
              setAspect={setAspect}
              loading={creating || authStatus === "loading"}
              onGenerate={handleGenerate}
            />
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => router.push("/projects")} className="btn-accent">
              Start a render <ArrowUpRight className="h-4 w-4" />
            </button>
            <Link href="/#showcase" className="btn-ghost">
              Browse showcase <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-6 text-sm text-muted">
            Free for 2 renders · No credit card ·{" "}
            <span className="font-mono">SOC 2 · GDPR · SAML</span>
          </p>
        </div>
      </section>

      {/* ─── Logos ────────────────────────────────────────────── */}
      <section
        className="relative mt-28 border-y border-rule"
        id="customers"
        style={{ background: "var(--paper)" }}
      >
        <div className="mx-auto max-w-[1400px] px-6 py-9">
          <p className="mono-tick mb-6 text-center">
            2,840 TEAMS SHIPPING VIDEO WITH REMAWT
          </p>
          <div className="grid grid-cols-2 items-center md:grid-cols-4 lg:grid-cols-8">
            {LOGOS.map((c, i) => (
              <div
                key={c}
                className={`py-2 text-center text-lg font-medium tracking-tight text-muted ${
                  i < LOGOS.length - 1 ? "lg:border-r" : ""
                } border-rule`}
              >
                {c}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────────────── */}
      <section className="relative px-6 py-32" id="product">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-16 text-center">
            <div className="kinetic-pill mx-auto mb-5">
              <span className="accent-dot" />
              <span className="mono-tick" style={{ color: "var(--ink)" }}>
                HOW IT WORKS · 03 STEPS
              </span>
            </div>
            <h2 className="text-4xl font-medium leading-[1.02] tracking-[-0.04em] md:text-6xl">
              From a prompt to a finished film in
              <br />
              <span style={{ color: "var(--accent)" }}>four minutes flat.</span>
            </h2>
          </div>

          <div className="relative grid grid-cols-1 gap-5 md:grid-cols-3">
            {/* connecting line */}
            <div
              className="pointer-events-none absolute top-8 hidden md:block"
              style={{
                left: "15%",
                right: "15%",
                height: 1,
                background:
                  "linear-gradient(90deg, rgba(59,130,246,0), rgba(59,130,246,0.5), rgba(59,130,246,0))",
                zIndex: 0,
              }}
            />
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="relative z-10 rounded-3xl p-8 pt-16"
                style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}
              >
                <div className="absolute left-7 top-6 flex items-center gap-2.5">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-full"
                    style={{
                      background: "var(--accent-soft)",
                      border: "1px solid rgba(59,130,246,0.40)",
                    }}
                  >
                    <span
                      className="font-mono text-[12px] font-semibold"
                      style={{ color: "var(--accent)" }}
                    >
                      {s.n}
                    </span>
                  </span>
                  <span className="mono-tick">{s.kicker.toUpperCase()}</span>
                </div>
                <h3 className="mb-3 text-2xl font-medium tracking-[-0.03em]">{s.t}</h3>
                <p className="text-sm leading-relaxed text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Bento features ───────────────────────────────────── */}
      <section className="relative border-t border-rule px-6 py-32">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-14 flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <div className="kinetic-pill mb-5">
                <span className="accent-dot" />
                <span className="mono-tick" style={{ color: "var(--ink)" }}>
                  WHAT'S IN THE BOX · 06 PRIMITIVES
                </span>
              </div>
              <h2 className="text-4xl font-medium leading-[1.02] tracking-[-0.04em] md:text-6xl">
                Every primitive a launch video needs.
              </h2>
            </div>
            <p className="max-w-sm text-base leading-relaxed text-muted">
              Each card is a node in the composition graph. Click any of them
              in the editor — re-render with new params, no waiting.
            </p>
          </div>

          <div className="grid auto-rows-[minmax(220px,auto)] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Big - Capture */}
            <Link href="/record" className="kinetic-bento p-7 lg:col-span-2 lg:row-span-2 flex flex-col transition-transform hover:-translate-y-0.5">
              <span className="mono-tick" style={{ color: "var(--accent)" }}>
                CAPTURE · 01
              </span>
              <h3 className="mt-3 text-2xl font-medium tracking-[-0.03em] md:text-3xl">
                Frame-perfect product recording
              </h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                Record interactions, hovers, scroll, and animation states.
                Stitched into shots — not screen recordings.
              </p>
              <div
                className="mt-auto rounded-xl border border-rule p-3"
                style={{ background: "var(--surface)" }}
              >
                <div className="flex items-center justify-between border-b border-rule pb-2 mb-2">
                  <span className="mono-tick">app.recording · REC</span>
                  <span className="flex items-center gap-1.5 mono-tick">
                    <span className="accent-dot" /> LIVE
                  </span>
                </div>
                <div className="relative h-44 overflow-hidden rounded-md" style={{ background: "var(--paper-2)" }}>
                  <div className="absolute inset-0 dot-grid opacity-50" />
                  <div className="absolute inset-x-3 bottom-3 flex h-1 items-center gap-0.5">
                    {Array.from({ length: 60 }).map((_, i) => (
                      <span
                        key={i}
                        className="h-full flex-1"
                        style={{
                          background: i < 22 ? "var(--accent)" : "rgba(245,245,247,0.10)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Link>

            {/* Type */}
            <Link href="/projects" className="kinetic-bento p-6 flex flex-col transition-transform hover:-translate-y-0.5">
              <span className="mono-tick" style={{ color: "var(--accent)" }}>TYPE · 02</span>
              <h3 className="mt-2.5 text-lg font-medium tracking-[-0.025em]">Kinetic captions</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                Auto-laid, beat-matched, brand-tuned.
              </p>
              <div className="mt-4 flex flex-col gap-1.5">
                <span className="self-start rounded-sm px-2.5 py-1 text-sm font-medium" style={{ background: "rgba(245,245,247,0.06)" }}>Faster.</span>
                <span className="self-end rounded-sm px-2.5 py-1 text-sm font-medium" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>Cleaner.</span>
                <span className="self-start rounded-sm px-2.5 py-1 text-sm font-medium" style={{ background: "rgba(245,245,247,0.06)" }}>Shipped.</span>
              </div>
            </Link>

            {/* Score */}
            <Link href="/projects" className="kinetic-bento p-6 flex flex-col transition-transform hover:-translate-y-0.5">
              <span className="mono-tick" style={{ color: "var(--accent)" }}>SCORE · 03</span>
              <h3 className="mt-2.5 text-lg font-medium tracking-[-0.025em]">Adaptive soundtrack</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                Generated. Royalty-free. Beat-matched to cuts.
              </p>
              <div className="mt-4 flex h-12 items-end gap-[3px]">
                {Array.from({ length: 26 }).map((_, i) => {
                  const h = 6 + Math.abs(Math.sin(i * 0.7)) * 40;
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-sm"
                      style={{
                        height: h,
                        background: i < 9 ? "var(--accent)" : "rgba(245,245,247,0.16)",
                      }}
                    />
                  );
                })}
              </div>
            </Link>

            {/* Brand */}
            <Link href="/projects" className="kinetic-bento p-6 flex flex-col transition-transform hover:-translate-y-0.5">
              <span className="mono-tick" style={{ color: "var(--accent)" }}>BRAND · 04</span>
              <h3 className="mt-2.5 text-lg font-medium tracking-[-0.025em]">Brand-locked output</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                Drop your style guide. Every frame respects it.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {["#3b82f6", "#7c5cff", "#00d17a", "#f5f5f7", "#0a0a0a"].map((c) => (
                  <div
                    key={c}
                    className="h-7 w-7 rounded-md"
                    style={{ background: c, border: "1px solid var(--rule)" }}
                  />
                ))}
                <div
                  className="flex items-center rounded-md px-2.5 py-1 text-[11px] text-muted"
                  style={{ border: "1px dashed var(--rule-strong)" }}
                >
                  + token
                </div>
              </div>
            </Link>

            {/* Callouts */}
            <Link href="/projects" className="kinetic-bento p-6 flex flex-col transition-transform hover:-translate-y-0.5">
              <span className="mono-tick" style={{ color: "var(--accent)" }}>CALLOUT · 05</span>
              <h3 className="mt-2.5 text-lg font-medium tracking-[-0.025em]">Smart callouts</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                Arrows, zooms, focus pulls, auto-placed.
              </p>
              <svg viewBox="0 0 220 80" className="mt-4 w-full">
                <rect x="10" y="20" width="90" height="44" rx="4" fill="rgba(245,245,247,0.06)" stroke="var(--rule)" />
                <rect x="110" y="10" width="100" height="60" rx="4" fill="rgba(59,130,246,0.12)" stroke="var(--accent)" strokeWidth="1.5" />
                <path d="M95 42 L110 30" stroke="var(--accent)" strokeWidth="1.5" />
                <circle cx="160" cy="40" r="14" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
              </svg>
            </Link>

            {/* Big - Editor */}
            <Link href="/projects" className="kinetic-bento p-7 lg:col-span-2 lg:row-span-2 flex flex-col transition-transform hover:-translate-y-0.5">
              <span className="mono-tick" style={{ color: "var(--accent)" }}>EDITOR · 06</span>
              <h3 className="mt-3 text-2xl font-medium tracking-[-0.03em] md:text-3xl">
                A timeline editor when you want it
              </h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                Drag any track, swap any scene, re-render in seconds. Or just
                press render and walk away.
              </p>
              <div
                className="mt-auto rounded-xl border border-rule p-4"
                style={{ background: "var(--surface)" }}
              >
                <MiniTimeline
                  bpm={sampleTrack.bpm}
                  durationSeconds={sampleTrack.duration}
                  trackName={sampleTrack.name}
                />
              </div>
            </Link>

            {/* Versions */}
            <Link href="/projects" className="kinetic-bento p-6 flex flex-col transition-transform hover:-translate-y-0.5">
              <span className="mono-tick" style={{ color: "var(--accent)" }}>VERSIONS · 07</span>
              <h3 className="mt-2.5 text-lg font-medium tracking-[-0.025em]">Re-render any version</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                Same brief, new product build. Deterministic.
              </p>
              <div className="mt-4 flex flex-col gap-1.5">
                {[
                  { v: "v4.2.1 · current", active: true },
                  { v: "v4.1.0", active: false },
                  { v: "v3.9.4 · pinned", active: false },
                ].map((it) => (
                  <div
                    key={it.v}
                    className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
                    style={{
                      background: it.active ? "var(--accent-soft)" : "rgba(245,245,247,0.04)",
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: it.active ? "var(--accent)" : "var(--subtle)" }}
                    />
                    <span
                      className="font-mono text-[11px]"
                      style={{ color: it.active ? "var(--accent)" : "var(--muted)" }}
                    >
                      {it.v}
                    </span>
                  </div>
                ))}
              </div>
            </Link>

            {/* I18n */}
            <Link href="/pricing" className="kinetic-bento p-6 flex flex-col transition-transform hover:-translate-y-0.5">
              <span className="mono-tick" style={{ color: "var(--accent)" }}>I18N · 08</span>
              <h3 className="mt-2.5 text-lg font-medium tracking-[-0.025em]">14 languages</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                Auto-translated captions, voiceovers, type lockups.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {["EN", "ES", "FR", "DE", "PT", "JA", "KO", "ZH", "AR", "HE", "IT", "NL", "TR", "PL"].map((l, i) => (
                  <span
                    key={l}
                    className="rounded px-1.5 py-0.5 font-mono text-[10px]"
                    style={{
                      background: i < 4 ? "var(--accent-soft)" : "rgba(245,245,247,0.05)",
                      color: i < 4 ? "var(--accent)" : "var(--muted)",
                    }}
                  >
                    {l}
                  </span>
                ))}
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Showcase ─────────────────────────────────────────── */}
      <section className="relative border-t border-rule px-6 py-32" id="showcase">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <div className="kinetic-pill mb-5">
                <span className="accent-dot" />
                <span className="mono-tick" style={{ color: "var(--ink)" }}>
                  SHOWCASE · LIVE FEED
                </span>
              </div>
              <h2 className="text-4xl font-medium leading-[1.02] tracking-[-0.04em] md:text-6xl">
                Just rendered.
              </h2>
            </div>
            <Link href="/projects" className="btn-ghost text-sm">
              See all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {showcase.length === 0 ? (
            <div
              className="rounded-2xl p-12 text-center"
              style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}
            >
              <p className="text-muted">No public renders yet — be the first.</p>
              <button
                type="button"
                onClick={() => router.push("/projects")}
                className="btn-accent mt-6 text-xs"
              >
                Start a render <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {showcase.map((p) => {
                const title = p.name || "Untitled render";
                const host = hostnameFromUrl(p.sourceUrl);
                const cat = host ? host.toUpperCase() : p.status;
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}/jitter`}
                    className="group rounded-2xl p-2.5 transition-transform hover:-translate-y-0.5"
                    style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}
                  >
                    <div
                      className="relative aspect-video overflow-hidden rounded-xl"
                      style={{ background: "var(--paper-2)" }}
                    >
                      <div className="absolute inset-0 dot-grid opacity-40" />
                      {p.videoUrl ? (
                        <video
                          src={p.videoUrl}
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                          onMouseLeave={(e) => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                          }}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : null}
                      <div className="absolute left-3 top-3 kinetic-pill !py-1 !px-2">
                        <span className="accent-dot" />
                        <span className="mono-tick">{cat}</span>
                      </div>
                    </div>
                    <div className="flex items-baseline justify-between px-2 pb-1.5 pt-3.5">
                      <h3 className="line-clamp-1 text-base font-medium tracking-[-0.02em]">{title}</h3>
                      <span className="mono-tick">{p.status}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ─── Use cases ────────────────────────────────────────── */}
      <section
        id="use-cases"
        className="relative border-t border-rule px-6 py-32"
      >
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-16 text-center">
            <div className="kinetic-pill mx-auto mb-5">
              <span className="accent-dot" />
              <span className="mono-tick" style={{ color: "var(--ink)" }}>
                USE CASES
              </span>
            </div>
            <h2 className="text-4xl font-medium leading-[1.02] tracking-[-0.04em] md:text-6xl">
              One engine.{" "}
              <span style={{ color: "var(--accent)" }}>
                Every cut you'd ever ship.
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map((u) => (
              <div
                key={u.code}
                className="kinetic-bento kinetic-bento-glow flex min-h-[320px] flex-col p-6"
              >
                <span
                  className="relative font-mono text-[11px]"
                  style={{ color: "var(--accent)", letterSpacing: "0.14em" }}
                >
                  {u.code}
                </span>
                <h3 className="relative mt-3 text-xl font-medium tracking-[-0.025em]">
                  {u.title}
                </h3>
                <p className="relative mt-3 flex-1 text-[13.5px] leading-relaxed text-muted">
                  {u.blurb}
                </p>
                <div className="relative mt-5 flex items-baseline gap-2.5 border-t border-rule pt-4">
                  <span className="text-3xl font-medium tracking-[-0.03em]">{u.stat}</span>
                  <span className="mono-tick">{u.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-rule px-6 py-40 text-center">
        <div className="pointer-events-none absolute inset-0 kinetic-dotgrid" />
        <div
          className="pointer-events-none absolute kinetic-glow"
          style={{
            top: "30%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 900,
            height: 700,
          }}
        />
        <div className="relative">
          <div className="kinetic-pill mx-auto mb-7">
            <span className="accent-dot glow-pulse" />
            <span className="mono-tick" style={{ color: "var(--ink)" }}>
              READY · GENERATE · SHIP
            </span>
          </div>
          <h2 className="text-[clamp(2.5rem,7vw,6rem)] font-normal leading-[0.96] tracking-[-0.05em]">
            Your next launch
            <br />
            <span style={{ color: "var(--accent)", fontStyle: "italic", fontWeight: 300 }}>
              renders in 4 minutes.
            </span>
          </h2>
          <p className="mx-auto mt-7 max-w-lg text-lg text-muted">
            Free to start. No credit card. Render two videos on the house — see
            the magic before you pay a dollar.
          </p>
          <div className="mt-10 inline-flex items-center gap-3">
            <button onClick={() => router.push("/projects")} className="btn-accent">
              Start rendering <ArrowUpRight className="h-4 w-4" />
            </button>
            <a href="mailto:support@remawt.com" className="btn-ghost">
              Book a demo
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
