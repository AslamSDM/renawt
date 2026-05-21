"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Spinner } from "@/components/ui";
import type { CursorEvent, ZoomPoint } from "@/lib/types";

interface EditorState {
  status: "loading" | "ready" | "saving" | "error";
  error?: string;
}

interface ParsedRecording {
  id: string;
  projectId: string;
  videoUrl: string;
  duration: number;
  cursorData: string;
  zoomPoints: string;
  trimStart: number;
  trimEnd: number;
  featureName: string;
  description: string;
  cursorStyle: string;
  createdAt: string;
}

export default function RecordingEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = React.use(params);
  
  const [state, setState] = useState<EditorState>({ status: "loading" });
  const [recording, setRecording] = useState<ParsedRecording | null>(null);
  const [cursorData, setCursorData] = useState<CursorEvent[]>([]);
  const [zoomPoints, setZoomPoints] = useState<ZoomPoint[]>([]);
  
  // Editor state
  const [featureName, setFeatureName] = useState("");
  const [description, setDescription] = useState("");
  const [cursorStyle, setCursorStyle] = useState<"mac" | "windows">("mac");
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedZoom, setSelectedZoom] = useState<number | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Load recording data
  useEffect(() => {
    async function loadRecording() {
      try {
        const response = await fetch(`/api/recordings/${id}`);
        if (!response.ok) throw new Error("Failed to load recording");
        
        const data = await response.json();
        const rec = data.recording as ParsedRecording;
        
        setRecording(rec);
        setCursorData(JSON.parse(rec.cursorData) as CursorEvent[]);
        setZoomPoints(JSON.parse(rec.zoomPoints) as ZoomPoint[]);
        setFeatureName(rec.featureName);
        setDescription(rec.description);
        setCursorStyle(rec.cursorStyle as "mac" | "windows");
        setTrimStart(rec.trimStart);
        setTrimEnd(rec.trimEnd || rec.duration);
        
        setState({ status: "ready" });
      } catch (error) {
        setState({ 
          status: "error", 
          error: error instanceof Error ? error.message : "Failed to load" 
        });
      }
    }

    loadRecording();
  }, [id]);

  // Video time update handler
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  // Auto-detect zoom points
  const handleAutoDetectZooms = useCallback(() => {
    const zooms: ZoomPoint[] = [];
    let lastZoomTime = -5; // Minimum 5 seconds between zooms

    for (let i = 0; i < cursorData.length; i++) {
      const event = cursorData[i];

      if (event.type === "click" || event.type === "input") {
        const eventTime = event.timestamp / 1000;
        
        // Skip if too close to last zoom
        if (eventTime - lastZoomTime < 5) continue;

        // Check if followed by rapid movement (skip if yes)
        let hasRapidMovement = false;
        for (let j = i + 1; j < cursorData.length; j++) {
          const nextEvent = cursorData[j];
          if (nextEvent.timestamp > event.timestamp + 500) break;

          if (nextEvent.type === "move") {
            const distance = Math.sqrt(
              Math.pow(nextEvent.x - event.x, 2) +
              Math.pow(nextEvent.y - event.y, 2)
            );
            if (distance > 50) {
              hasRapidMovement = true;
              break;
            }
          }
        }

        if (hasRapidMovement) continue;

        zooms.push({
          time: eventTime,
          x: event.x / (videoRef.current?.videoWidth || 1920),
          y: event.y / (videoRef.current?.videoHeight || 1080),
          scale: 1.5,
          duration: 2
        });

        lastZoomTime = eventTime;
      }
    }

    setZoomPoints(zooms.slice(0, 5));
  }, [cursorData]);

  // Add manual zoom point
  const handleAddZoom = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const newZoom: ZoomPoint = {
      time: currentTime,
      x,
      y,
      scale: 1.5,
      duration: 2
    };

    setZoomPoints(prev => [...prev, newZoom].sort((a, b) => a.time - b.time));
  }, [currentTime]);

  // Remove zoom point
  const handleRemoveZoom = useCallback((index: number) => {
    setZoomPoints(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Update zoom point
  const handleUpdateZoom = useCallback((index: number, updates: Partial<ZoomPoint>) => {
    setZoomPoints(prev => prev.map((zoom, i) => 
      i === index ? { ...zoom, ...updates } : zoom
    ));
  }, []);

  // Handle timeline click
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current || !recording) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * recording.duration;

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [recording]);

  // Save changes
  const handleSave = useCallback(async () => {
    if (!recording) return;

    setState(prev => ({ ...prev, status: "saving" }));

    try {
      const response = await fetch(`/api/recordings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trimStart,
          trimEnd,
          zoomPoints,
          featureName,
          description,
          cursorStyle
        })
      });

      if (!response.ok) throw new Error("Failed to save");

      setState({ status: "ready" });
    } catch (error) {
      setState({ 
        status: "error", 
        error: error instanceof Error ? error.message : "Failed to save" 
      });
    }
  }, [id, trimStart, trimEnd, zoomPoints, featureName, description, cursorStyle, recording]);

  // Add to project
  const handleAddToProject = useCallback(async () => {
    if (!recording) return;

    // First save any pending changes
    await handleSave();

    // Navigate to project studio
    router.push(`/studio/${recording.projectId}?addRecording=${id}`);
  }, [recording, id, handleSave, router]);

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  if (state.status === "loading") {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-muted">Loading recording...</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Card className="max-w-md text-center p-8">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-semibold text-ink mb-2">Error</h1>
          <p className="text-muted mb-6">{state.error}</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </Card>
      </div>
    );
  }

  if (!recording) return null;

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
            <button
              onClick={() => router.back()}
              className="text-muted hover:text-ink transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="kinetic-pill !py-1 !px-2.5">
              <span className="accent-dot" />
              <span className="mono-tick" style={{ color: "var(--ink)" }}>RECORDING · EDIT</span>
            </span>
            <h1 className="text-base font-medium tracking-[-0.02em]">Edit Recording</h1>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="secondary"
              onClick={handleSave}
              disabled={state.status === "saving"}
            >
              {state.status === "saving" ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
            <Button onClick={handleAddToProject}>
              Add to Project
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Video Preview */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="aspect-video bg-black overflow-hidden relative">
              <video
                ref={videoRef}
                src={recording.videoUrl}
                className="w-full h-full"
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                controls
              />
            </Card>

            {/* Timeline */}
            <Card className="p-4">
              <div className="flex items-center gap-4 mb-2">
                <span className="text-sm text-muted font-mono">
                  {formatTime(currentTime)}
                </span>
                <div 
                  ref={timelineRef}
                  className="flex-1 h-12 bg-paper-3 rounded-lg relative cursor-pointer overflow-hidden"
                  onClick={handleTimelineClick}
                >
                  {/* Progress bar */}
                  <div 
                    className="absolute left-0 top-0 h-full bg-ink/30"
                    style={{ width: `${(currentTime / recording.duration) * 100}%` }}
                  />
                  
                  {/* Zoom points */}
                  {zoomPoints.map((zoom, index) => (
                    <div
                      key={index}
                      className={`absolute top-1 bottom-1 w-1 rounded cursor-pointer transition-all ${
                        selectedZoom === index ? "bg-ink w-2" : "bg-yellow-500/70"
                      }`}
                      style={{ 
                        left: `${(zoom.time / recording.duration) * 100}%`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedZoom(index);
                        if (videoRef.current) {
                          videoRef.current.currentTime = zoom.time;
                        }
                      }}
                      title={`Zoom at ${formatTime(zoom.time)}`}
                    />
                  ))}

                  {/* Trim markers */}
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-red-500"
                    style={{ left: `${(trimStart / recording.duration) * 100}%` }}
                  />
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-red-500"
                    style={{ left: `${(trimEnd / recording.duration) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-muted font-mono">
                  {formatTime(recording.duration)}
                </span>
              </div>
            </Card>
          </div>

          {/* Controls */}
          <div className="space-y-6">
            {/* Feature Info */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Feature Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted mb-2">
                    Feature Name
                  </label>
                  <input
                    type="text"
                    value={featureName}
                    onChange={(e) => setFeatureName(e.target.value)}
                    className="w-full px-3 py-2 bg-paper-3 border border-rule-strong rounded-lg text-ink focus:outline-none focus:border-ink"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-paper-3 border border-rule-strong rounded-lg text-ink focus:outline-none focus:border-ink resize-none"
                  />
                </div>
              </div>
            </Card>

            {/* Cursor Style */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Cursor Style</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => setCursorStyle("mac")}
                  className={`flex-1 py-3 px-4 rounded-lg border transition-all ${
                    cursorStyle === "mac"
                      ? "bg-ink/20 border-blue-500 text-ink"
                      : "bg-paper-3 border-rule-strong text-muted hover:border-rule-strong"
                  }`}
                >
                  <div className="text-2xl mb-1">🖱️</div>
                  <div className="text-sm">Mac</div>
                </button>
                <button
                  onClick={() => setCursorStyle("windows")}
                  className={`flex-1 py-3 px-4 rounded-lg border transition-all ${
                    cursorStyle === "windows"
                      ? "bg-ink/20 border-blue-500 text-ink"
                      : "bg-paper-3 border-rule-strong text-muted hover:border-rule-strong"
                  }`}
                >
                  <div className="text-2xl mb-1">🖱️</div>
                  <div className="text-sm">Windows</div>
                </button>
              </div>
            </Card>

            {/* Trim Controls */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Trim</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted mb-2">
                    Start Time: {formatTime(trimStart)}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={recording.duration}
                    step={0.1}
                    value={trimStart}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setTrimStart(Math.min(val, trimEnd - 1));
                    }}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted mb-2">
                    End Time: {formatTime(trimEnd)}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={recording.duration}
                    step={0.1}
                    value={trimEnd}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setTrimEnd(Math.max(val, trimStart + 1));
                    }}
                    className="w-full"
                  />
                </div>
              </div>
            </Card>

            {/* Zoom Controls */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Zoom Points</h3>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={handleAutoDetectZooms}
                >
                  Auto-Detect
                </Button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {zoomPoints.length === 0 ? (
                  <p className="text-sm text-muted text-center py-4">
                    No zoom points. Click "Auto-Detect" to find zoom points automatically.
                  </p>
                ) : (
                  zoomPoints.map((zoom, index) => (
                    <div 
                      key={index}
                      className={`p-3 rounded-lg border transition-all ${
                        selectedZoom === index 
                          ? "bg-ink/10 border-blue-500" 
                          : "bg-paper-3 border-rule-strong"
                      }`}
                      onClick={() => setSelectedZoom(index)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          Zoom {index + 1}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveZoom(index);
                          }}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted">Time:</span>{" "}
                          {formatTime(zoom.time)}
                        </div>
                        <div>
                          <span className="text-muted">Scale:</span>{" "}
                          {zoom.scale}x
                        </div>
                      </div>
                      {selectedZoom === index && (
                        <div className="mt-3 pt-3 border-t border-rule-strong">
                          <label className="block text-xs text-muted mb-1">
                            Scale: {zoom.scale}x
                          </label>
                          <input
                            type="range"
                            min={1.2}
                            max={2.5}
                            step={0.1}
                            value={zoom.scale}
                            onChange={(e) => handleUpdateZoom(index, { scale: parseFloat(e.target.value) })}
                            className="w-full"
                          />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Info */}
            <Card className="p-4">
              <h4 className="text-sm font-medium text-muted mb-2">Recording Info</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Duration:</span>
                  <span>{formatTime(recording.duration)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Cursor Events:</span>
                  <span>{cursorData.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Zoom Points:</span>
                  <span>{zoomPoints.length}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
