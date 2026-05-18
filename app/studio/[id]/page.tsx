"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { Button, Card, CardHeader, Spinner } from "@/components/ui";
import type { ProductData, VideoScript, ScreenRecording } from "@/lib/types";

interface Project {
  id: string;
  sourceUrl: string | null;
  description: string | null;
  productData: ProductData | null;
  script: VideoScript | null;
  composition: string | null;
  audioUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function StudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [recordings, setRecordings] = useState<ScreenRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"scenes" | "code" | "data" | "recordings">(
    "scenes",
  );

  useEffect(() => {
    async function fetchProject() {
      try {
        const [projectRes, recordingsRes] = await Promise.all([
          fetch(`/api/projects/${id}`),
          fetch(`/api/recordings?projectId=${id}`)
        ]);
        
        if (!projectRes.ok) {
          throw new Error("Project not found");
        }
        
        const projectData = await projectRes.json();
        setProject(projectData.project);
        
        if (recordingsRes.ok) {
          const recordingsData = await recordingsRes.json();
          setRecordings(recordingsData.recordings || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load project");
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [id]);

  const handleAddRecordingToScript = async (recording: ScreenRecording) => {
    if (!project?.script) return;

    // Calculate frame positions (30fps)
    const fps = 30;
    const lastScene = project.script.scenes[project.script.scenes.length - 1];
    const startFrame = lastScene ? lastScene.endFrame : 0;
    const durationFrames = Math.round(recording.duration * fps);

    // Create new recording scene
    const recordingScene = {
      id: `recording-${recording.id}`,
      startFrame,
      endFrame: startFrame + durationFrames,
      type: "recording" as const,
      content: {
        recordingId: recording.id,
        featureName: recording.featureName,
        description: recording.description
      },
      animation: {
        enter: "fade" as const,
        exit: "fade" as const
      },
      style: {
        background: "#000000",
        textColor: "#ffffff",
        fontSize: "medium" as const
      }
    };

    // Update script with new scene
    const updatedScript = {
      ...project.script,
      scenes: [...project.script.scenes, recordingScene],
      totalDuration: startFrame + durationFrames
    };

    // Save to server
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: JSON.stringify(updatedScript) })
      });

      if (response.ok) {
        setProject(prev => prev ? { ...prev, script: updatedScript } : null);
        alert(`Added "${recording.featureName}" to video!`);
      }
    } catch (error) {
      console.error("Failed to add recording:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-2  flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-subtle ">
            Loading project...
          </p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-surface-2  flex items-center justify-center">
        <Card className="max-w-md text-center">
          <div className="text-4xl mb-4">😕</div>
          <h2 className="text-xl font-semibold text-ink  mb-2">
            Project Not Found
          </h2>
          <p className="text-subtle  mb-6">
            {error || "The project you're looking for doesn't exist."}
          </p>
          <Link href="/">
            <Button>Back to Home</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface text-ink">
      <div className="pointer-events-none absolute inset-0 kinetic-dotgrid" />
      <div
        className="pointer-events-none absolute kinetic-glow-soft"
        style={{ top: -150, left: "50%", transform: "translateX(-50%)", width: 1000, height: 500 }}
      />

      {/* Header */}
      <header
        className="relative z-10 sticky top-0 backdrop-blur-md"
        style={{ background: "rgba(7,7,10,0.7)", borderBottom: "1px solid var(--rule)" }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/projects"
              className="text-muted hover:text-ink transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <span className="kinetic-pill !py-1 !px-2.5">
              <span className="accent-dot" />
              <span className="mono-tick" style={{ color: "var(--ink)" }}>STUDIO</span>
            </span>
            <div>
              <h1 className="text-base font-medium tracking-[-0.02em] text-ink">
                {project.productData?.name || "Untitled Video"}
              </h1>
              <p className="text-xs text-muted">
                {project.script
                  ? `${Math.round(project.script.totalDuration / 30)}s video`
                  : "Draft"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm">
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              Share
            </Button>
            <Button size="sm">
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Export MP4
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Video Player */}
          <div className="lg:col-span-2">
            <Card padding="none" className="overflow-hidden">
              <VideoPlayer
                script={project.script || undefined}
                code={project.composition || undefined}
                audioUrl={project.audioUrl}
                className="p-4"
              />
            </Card>
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Panel Tabs */}
            <div
              className="flex gap-1 rounded-full p-1"
              style={{ background: "var(--paper)", border: "1px solid var(--rule)" }}
            >
              {(["scenes", "data", "code", "recordings"] as const).map((p) => {
                const active = activePanel === p;
                return (
                  <button
                    key={p}
                    onClick={() => setActivePanel(p)}
                    className="rounded-full px-3 py-1.5 text-[13px] font-medium capitalize transition-colors"
                    style={{
                      background: active ? "var(--accent-soft)" : "transparent",
                      color: active ? "var(--accent)" : "var(--muted)",
                      border: active ? "1px solid rgba(59,130,246,0.40)" : "1px solid transparent",
                    }}
                  >
                    {p}
                    {p === "recordings" && recordings.length > 0 && (
                      <span
                        className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]"
                        style={{
                          background: active ? "rgba(59,130,246,0.20)" : "rgba(245,245,247,0.08)",
                        }}
                      >
                        {recordings.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Scenes Panel */}
            {activePanel === "scenes" && project.script && (
              <Card>
                <CardHeader title="Video Scenes" />
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {project.script.scenes.map((scene, index) => (
                    <div
                      key={scene.id}
                      className="p-3 bg-paper-2  rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted  uppercase">
                          {scene.type}
                        </span>
                        <span className="text-xs text-muted">
                          {Math.round(scene.startFrame / 30)}s -{" "}
                          {Math.round(scene.endFrame / 30)}s
                        </span>
                      </div>
                      {scene.content.headline && (
                        <p className="text-sm font-medium text-ink ">
                          {scene.content.headline}
                        </p>
                      )}
                      {scene.content.subtext && (
                        <p className="text-xs text-muted  mt-1">
                          {scene.content.subtext}
                        </p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <span
                          className="inline-block w-4 h-4 rounded"
                          style={{ background: scene.style.background }}
                        />
                        <span className="text-xs text-muted">
                          {scene.animation.enter} → {scene.animation.exit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Data Panel */}
            {activePanel === "data" && project.productData && (
              <Card>
                <CardHeader title="Product Data" />
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted  uppercase">
                      Name
                    </label>
                    <p className="text-sm text-ink ">
                      {project.productData.name}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted  uppercase">
                      Tagline
                    </label>
                    <p className="text-sm text-ink ">
                      {project.productData.tagline}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted  uppercase">
                      Features
                    </label>
                    <ul className="text-sm text-subtle  list-disc list-inside">
                      {project.productData.features.map((f, i) => (
                        <li key={i}>{f.title}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted  uppercase">
                      Colors
                    </label>
                    <div className="flex gap-2 mt-1">
                      <div
                        className="w-8 h-8 rounded"
                        style={{
                          background: project.productData.colors.primary,
                        }}
                        title="Primary"
                      />
                      <div
                        className="w-8 h-8 rounded"
                        style={{
                          background: project.productData.colors.secondary,
                        }}
                        title="Secondary"
                      />
                      <div
                        className="w-8 h-8 rounded"
                        style={{
                          background: project.productData.colors.accent,
                        }}
                        title="Accent"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Code Panel */}
            {activePanel === "code" && project.composition && (
              <Card padding="none">
                <div className="p-4 border-b border-rule ">
                  <CardHeader title="Generated Code" />
                </div>
                <pre className="p-4 text-xs text-subtle  overflow-auto max-h-[500px] bg-paper-2 ">
                  <code>{project.composition}</code>
                </pre>
              </Card>
            )}

            {/* Recordings Panel */}
            {activePanel === "recordings" && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <CardHeader title="Screen Recordings" />
                  <Link href={`/record?projectId=${id}`}>
                    <Button size="sm">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Record New
                    </Button>
                  </Link>
                </div>
                
                {recordings.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">📹</div>
                    <h3 className="font-medium text-ink  mb-2">
                      No Recordings Yet
                    </h3>
                    <p className="text-sm text-muted  mb-4">
                      Record your screen to demonstrate product features.
                    </p>
                    <Link href={`/record?projectId=${id}`}>
                      <Button size="sm">Start Recording</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {recordings.map((recording) => (
                      <div
                        key={recording.id}
                        className="p-3 bg-paper-2  rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-blue-600  uppercase">
                            Recording
                          </span>
                          <span className="text-xs text-muted">
                            {Math.round(recording.duration)}s
                          </span>
                        </div>
                        <p className="text-sm font-medium text-ink ">
                          {recording.featureName}
                        </p>
                        {recording.description && (
                          <p className="text-xs text-muted  mt-1 line-clamp-2">
                            {recording.description}
                          </p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <Link href={`/editor/recording/${recording.id}`} className="flex-1">
                            <Button variant="secondary" size="sm" className="w-full">
                              Edit
                            </Button>
                          </Link>
                          {project.script && (
                            <Button 
                              size="sm" 
                              className="flex-1"
                              onClick={() => handleAddRecordingToScript(recording)}
                            >
                              Add to Video
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* No Script Warning */}
            {!project.script && (
              <Card>
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🎬</div>
                  <h3 className="font-medium text-ink  mb-2">
                    No Video Generated
                  </h3>
                  <p className="text-sm text-muted  mb-4">
                    This project doesn't have a generated video yet.
                  </p>
                  <Link href="/">
                    <Button size="sm">Generate Video</Button>
                  </Link>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
