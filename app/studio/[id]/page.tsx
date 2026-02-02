"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { Button, Card, CardHeader, Spinner } from "@/components/ui";
import type { ProductData, VideoScript } from "@/lib/types";

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
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"scenes" | "code" | "data">(
    "scenes"
  );

  useEffect(() => {
    async function fetchProject() {
      try {
        const response = await fetch(`/api/projects/${id}`);
        if (!response.ok) {
          throw new Error("Project not found");
        }
        const data = await response.json();
        setProject(data.project);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load project");
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading project...
          </p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Card className="max-w-md text-center">
          <div className="text-4xl mb-4">😕</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Project Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg
                className="w-6 h-6"
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
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {project.productData?.name || "Untitled Video"}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
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
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Video Player */}
          <div className="lg:col-span-2">
            <Card padding="none" className="overflow-hidden">
              <VideoPlayer
                script={project.script || undefined}
                code={project.composition || undefined}
                className="p-4"
              />
            </Card>
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            {/* Panel Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setActivePanel("scenes")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activePanel === "scenes"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                Scenes
              </button>
              <button
                onClick={() => setActivePanel("data")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activePanel === "data"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                Data
              </button>
              <button
                onClick={() => setActivePanel("code")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activePanel === "code"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                Code
              </button>
            </div>

            {/* Scenes Panel */}
            {activePanel === "scenes" && project.script && (
              <Card>
                <CardHeader title="Video Scenes" />
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {project.script.scenes.map((scene, index) => (
                    <div
                      key={scene.id}
                      className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          {scene.type}
                        </span>
                        <span className="text-xs text-gray-400">
                          {Math.round(scene.startFrame / 30)}s -{" "}
                          {Math.round(scene.endFrame / 30)}s
                        </span>
                      </div>
                      {scene.content.headline && (
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {scene.content.headline}
                        </p>
                      )}
                      {scene.content.subtext && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {scene.content.subtext}
                        </p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <span
                          className="inline-block w-4 h-4 rounded"
                          style={{ background: scene.style.background }}
                        />
                        <span className="text-xs text-gray-400">
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
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Name
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {project.productData.name}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Tagline
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {project.productData.tagline}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Features
                    </label>
                    <ul className="text-sm text-gray-700 dark:text-gray-300 list-disc list-inside">
                      {project.productData.features.map((f, i) => (
                        <li key={i}>{f.title}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
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
                        style={{ background: project.productData.colors.accent }}
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
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <CardHeader title="Generated Code" />
                </div>
                <pre className="p-4 text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-[500px] bg-gray-50 dark:bg-gray-800">
                  <code>{project.composition}</code>
                </pre>
              </Card>
            )}

            {/* No Script Warning */}
            {!project.script && (
              <Card>
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🎬</div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                    No Video Generated
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
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
