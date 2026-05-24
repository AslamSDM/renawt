"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import {
  Plus,
  Film,
  Clock,
  Trash2,
  Copy,
  Edit2,
  Check,
  X,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";

interface Project {
  id: string;
  name: string | null;
  sourceUrl: string | null;
  description: string | null;
  status: string;
  videoUrl: string | null;
  generationCount: number;
  latestGeneration: {
    id: string;
    status: string;
    videoUrl: string | null;
    createdAt: string;
    startedAt: string;
    finishedAt: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CHIP: Record<string, { bg: string; color: string; border: string }> = {
  READY: { bg: "var(--accent-soft)", color: "var(--accent)", border: "rgba(59,130,246,0.40)" },
  GENERATING: { bg: "var(--accent-soft)", color: "var(--accent)", border: "rgba(59,130,246,0.40)" },
  EXPORTED: { bg: "rgba(245,245,247,0.06)", color: "var(--ink)", border: "var(--rule-strong)" },
  DRAFT: { bg: "rgba(245,245,247,0.04)", color: "var(--muted)", border: "var(--rule)" },
  FAILED: { bg: "rgba(239,68,68,0.10)", color: "rgb(239,68,68)", border: "rgba(239,68,68,0.40)" },
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const anyOngoing = projects.some((p) => p.status === "GENERATING");
    if (!anyOngoing) return;
    const t = setInterval(fetchProjects, 4000);
    return () => clearInterval(t);
  }, [projects]);

  const createProject = async () => {
    setCreating(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Project", status: "DRAFT" }),
      });
      const data = await response.json();
      if (data.project) {
        router.push(`/projects/${data.project.id}/jitter`);
      }
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setCreating(false);
    }
  };

  const startEditing = (project: Project, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(project.id);
    setEditingName(project.name || "Untitled Project");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveProjectName = async (projectId: string) => {
    if (!editingName.trim()) return;
    setSavingName(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      if (response.ok) {
        setProjects(
          projects.map((p) =>
            p.id === projectId ? { ...p, name: editingName.trim() } : p,
          ),
        );
        setEditingId(null);
      }
    } catch (error) {
      console.error("Failed to update project name:", error);
    } finally {
      setSavingName(false);
    }
  };

  const deleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      setProjects(projects.filter((p) => p.id !== projectId));
    } catch (error) {
      console.error("Failed to delete project:", error);
    }
  };

  const duplicateProject = async (project: Project, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${project.name || "Untitled"} (Copy)`,
          sourceUrl: project.sourceUrl,
          status: "DRAFT",
        }),
      });
      const data = await response.json();
      if (data.project) {
        router.push(`/projects/${data.project.id}/jitter`);
      }
    } catch (error) {
      console.error("Failed to duplicate project:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes === 0 ? "Just now" : `${minutes}m ago`;
      }
      return `${hours}h ago`;
    }
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface text-ink">
      {/* Ambient backdrop */}
      <div className="pointer-events-none absolute inset-0 kinetic-dotgrid" />
      <div
        className="pointer-events-none absolute kinetic-glow-soft"
        style={{ top: -200, left: "50%", transform: "translateX(-50%)", width: 1200, height: 600 }}
      />

      <Navbar />

      <main className="relative mx-auto max-w-[1400px] px-6 pt-32 pb-20">
        {/* Header pill */}
        <div className="mb-10 flex flex-wrap items-center gap-3">
          <span className="kinetic-pill !py-1.5 !px-3">
            <span className="accent-dot" />
            <span className="mono-tick" style={{ color: "var(--ink)" }}>
              STUDIO · PROJECTS
            </span>
          </span>
          <span className="kinetic-pill !py-1.5 !px-3">
            <span className="mono-tick" style={{ color: "var(--muted)" }}>
              {projects.length} PROJECT{projects.length !== 1 ? "S" : ""}
            </span>
          </span>
          <span className="kinetic-pill !py-1.5 !px-3">
            <span className="accent-dot glow-pulse" />
            <span className="mono-tick" style={{ color: "var(--accent)" }}>
              QUEUE LIVE
            </span>
          </span>
        </div>

        {/* Title + CTAs */}
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-[clamp(2.25rem,7vw,5.5rem)] font-medium leading-[0.95] tracking-[-0.04em]">
              Your <span style={{ color: "var(--accent)", fontStyle: "italic", fontWeight: 300 }}>reels.</span>
            </h1>
            <p className="mt-4 text-muted">
              Every project in one shelf. Edit, duplicate, ship.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => createProject()}
              disabled={creating}
              className="btn-accent disabled:opacity-50"
            >
              {creating ? (
                <span className="h-4 w-4 animate-spin rounded-full border border-black/30 border-t-black" />
              ) : (
                <Sparkles className="h-4 w-4" strokeWidth={1.6} />
              )}
              New project
            </button>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-32">
            <div className="h-8 w-8 animate-spin rounded-full border border-rule border-t-ink" />
          </div>
        ) : projects.length === 0 ? (
          <div
            className="kinetic-bento kinetic-bento-glow mt-16 p-16 text-center"
          >
            <div
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl"
              style={{ background: "var(--accent-soft)", border: "1px solid rgba(59,130,246,0.40)" }}
            >
              <Film className="h-8 w-8" style={{ color: "var(--accent)" }} strokeWidth={1.4} />
            </div>
            <h2 className="mt-6 text-3xl font-medium tracking-[-0.025em]">
              No projects yet.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-muted">
              Spin up your first reel and the engine takes it from there.
            </p>
            <button
              onClick={() => createProject()}
              disabled={creating}
              className="btn-accent mt-8 disabled:opacity-50"
            >
              {creating ? (
                <span className="h-4 w-4 animate-spin rounded-full border border-black/30 border-t-black" />
              ) : (
                <Plus className="h-4 w-4" strokeWidth={1.6} />
              )}
              Create first project
            </button>
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}/jitter`}
                className="group kinetic-bento flex flex-col p-2.5 transition-transform hover:-translate-y-0.5"
              >
                <div
                  className="relative aspect-video overflow-hidden rounded-xl"
                  style={{ background: "var(--paper-2)", border: "1px solid var(--rule)" }}
                >
                  <div className="absolute inset-0 dot-grid opacity-40" />
                  {project.videoUrl ? (
                    <video
                      src={project.videoUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="absolute inset-0 h-full w-full object-cover"
                      onMouseEnter={(e) => {
                        const v = e.currentTarget;
                        v.currentTime = 0;
                        v.play().catch(() => {});
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.pause();
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Film
                        className="h-10 w-10"
                        style={{ color: "var(--rule-strong)" }}
                        strokeWidth={1.2}
                      />
                    </div>
                  )}
                  {project.status === "GENERATING" ? (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: "rgba(7,7,10,0.55)" }}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="h-6 w-6 animate-spin rounded-full border border-rule border-t-ink" />
                        <span className="mono-tick" style={{ color: "var(--accent)" }}>
                          GENERATING…
                        </span>
                      </div>
                    </div>
                  ) : null}
                  <div className="absolute left-3 top-3 kinetic-pill !py-1 !px-2">
                    <span className="accent-dot" />
                    <span className="mono-tick" style={{ color: "var(--ink)" }}>
                      {project.generationCount > 0
                        ? `${project.generationCount} REND${project.generationCount !== 1 ? "S" : ""}`
                        : "EMPTY"}
                    </span>
                  </div>
                </div>

                <div className="mt-3.5 flex items-start justify-between gap-2 px-2">
                  {editingId === project.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveProjectName(project.id);
                          if (e.key === "Escape") cancelEditing();
                        }}
                        className="flex-1 border border-rule-strong bg-paper px-2 py-1 text-sm focus:border-ink focus:outline-none"
                        autoFocus
                        onClick={(e) => e.preventDefault()}
                      />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          saveProjectName(project.id);
                        }}
                        disabled={savingName}
                        className="p-1 text-ink hover:opacity-70"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          cancelEditing();
                        }}
                        className="p-1 text-muted hover:text-ink"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <h3 className="line-clamp-1 flex-1 text-base font-medium tracking-[-0.02em] text-ink">
                      {project.name || "Untitled Project"}
                    </h3>
                  )}
                  <ArrowUpRight className="h-4 w-4 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>

                <div className="mt-1.5 flex items-center gap-2 px-2 mono-tick">
                  <Clock className="h-3 w-3" strokeWidth={1.8} />
                  {formatDate(project.updatedAt).toUpperCase()}
                </div>

                <div className="mt-4 flex items-center justify-between px-2 pb-2">
                  {(() => {
                    const s = STATUS_CHIP[project.status] || {
                      bg: "rgba(245,245,247,0.04)",
                      color: "var(--muted)",
                      border: "var(--rule)",
                    };
                    return (
                      <span
                        className="rounded-full px-2.5 py-0.5 font-mono text-[10px] tracking-[0.14em]"
                        style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                      >
                        {project.status}
                      </span>
                    );
                  })()}

                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startEditing(project, e);
                      }}
                      className="rounded-sm p-1.5 text-muted transition-colors hover:bg-paper-3 hover:text-ink"
                      title="Rename"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => duplicateProject(project, e)}
                      className="rounded-sm p-1.5 text-muted transition-colors hover:bg-paper-3 hover:text-ink"
                      title="Duplicate"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => deleteProject(project.id, e)}
                      className="rounded-sm p-1.5 text-muted transition-colors hover:bg-paper-3 hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </Link>
            ))}

            {/* New project card */}
            <button
              onClick={() => createProject()}
              disabled={creating}
              className="group kinetic-bento kinetic-bento-glow flex min-h-[280px] flex-col items-center justify-center gap-4 p-5 transition-transform hover:-translate-y-0.5"
            >
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: "var(--accent-soft)", border: "1px solid rgba(59,130,246,0.40)" }}
              >
                {creating ? (
                  <span className="h-5 w-5 animate-spin rounded-full border border-rule border-t-ink" />
                ) : (
                  <Plus className="h-6 w-6" style={{ color: "var(--accent)" }} strokeWidth={1.4} />
                )}
              </div>
              <span className="text-xl font-medium tracking-[-0.025em]">
                {creating ? "Creating..." : "New project"}
              </span>
              <span className="mono-tick">TAP TO START</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
