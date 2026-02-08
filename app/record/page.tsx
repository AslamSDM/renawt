"use client";

import React, { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Spinner } from "@/components/ui";
import { CursorTracker, CursorEvent, detectZoomPoints } from "@/lib/recording/cursorTracker";

interface RecordingState {
  status: "idle" | "countdown" | "recording" | "preview" | "saving" | "error";
  countdown: number;
  recordingTime: number;
  error?: string;
}

function RecordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  const [state, setState] = useState<RecordingState>({
    status: "idle",
    countdown: 3,
    recordingTime: 0
  });

  const [showInstructions, setShowInstructions] = useState(true);
  const [featureName, setFeatureName] = useState("");
  const [description, setDescription] = useState("");
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cursorTrackerRef = useRef<CursorTracker | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const startCountdown = useCallback(() => {
    setState({ status: "countdown", countdown: 3, recordingTime: 0 });
    
    let count = 3;
    countdownRef.current = setInterval(() => {
      count--;
      if (count > 0) {
        setState(prev => ({ ...prev, countdown: count }));
      } else {
        clearInterval(countdownRef.current!);
        startRecording();
      }
    }, 1000);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // Get screen stream
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false // No audio recording as per requirements
      });

      streamRef.current = stream;

      // Setup media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9"
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setVideoBlob(blob);
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setState(prev => ({ ...prev, status: "preview" }));
      };

      // Start cursor tracking
      cursorTrackerRef.current = new CursorTracker();
      cursorTrackerRef.current.start();

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setState({ status: "recording", countdown: 0, recordingTime: 0 });

      // Start timer
      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds++;
        setState(prev => ({ ...prev, recordingTime: seconds }));
      }, 1000);

      // Listen for stream end (user stops sharing)
      stream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

    } catch (error) {
      console.error("Failed to start recording:", error);
      setState({
        status: "error",
        countdown: 0,
        recordingTime: 0,
        error: "Failed to access screen. Please allow screen sharing permissions."
      });
    }
  }, []);

  const stopRecording = useCallback(() => {
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop countdown if active
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    // Stop cursor tracking
    if (cursorTrackerRef.current) {
      cursorTrackerRef.current.stop();
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!videoBlob || !cursorTrackerRef.current || !projectId) return;

    setState(prev => ({ ...prev, status: "saving" }));

    try {
      const cursorData = cursorTrackerRef.current.stop();
      const zoomPoints = detectZoomPoints(cursorData);

      // Create form data
      const formData = new FormData();
      formData.append("video", videoBlob, "recording.webm");
      formData.append("projectId", projectId);
      formData.append("cursorData", JSON.stringify(cursorData));
      formData.append("zoomPoints", JSON.stringify(zoomPoints));
      formData.append("featureName", featureName || "Feature Demo");
      formData.append("description", description || "");
      formData.append("duration", String(state.recordingTime));

      // Upload recording
      const response = await fetch("/api/recordings", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("Failed to save recording");
      }

      const data = await response.json();

      // Redirect to editor
      router.push(`/editor/recording/${data.recordingId}`);

    } catch (error) {
      console.error("Failed to save recording:", error);
      setState(prev => ({
        ...prev,
        status: "error",
        error: "Failed to save recording. Please try again."
      }));
    }
  }, [videoBlob, projectId, featureName, description, state.recordingTime, router]);

  const handleDiscard = useCallback(() => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoBlob(null);
    setVideoUrl(null);
    setFeatureName("");
    setDescription("");
    setState({ status: "idle", countdown: 3, recordingTime: 0 });
  }, [videoUrl]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!projectId) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Card className="max-w-md text-center p-8">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-white mb-2">No Project Selected</h1>
          <p className="text-gray-400 mb-6">
            Please select a project to record a feature demo.
          </p>
          <Button onClick={() => router.push("/")}>Go Home</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Instructions Modal */}
      {showInstructions && state.status === "idle" && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Before You Record</h2>
            <div className="space-y-4 text-gray-300">
              <div className="flex items-start gap-3">
                <span className="text-yellow-400 text-xl">1.</span>
                <div>
                  <p className="font-medium text-white">Hide Your Cursor</p>
                  <p className="text-sm">
                    Please hide your cursor before recording. On Mac: System Settings → Accessibility → Display → Pointer Size (set to minimum). 
                    On Windows: Settings → Ease of Access → Mouse pointer → Change pointer size (set to smallest).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow-400 text-xl">2.</span>
                <div>
                  <p className="font-medium text-white">Record Your Screen</p>
                  <p className="text-sm">
                    Click "Start Recording" and select the window or screen you want to record.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow-400 text-xl">3.</span>
                <div>
                  <p className="font-medium text-white">Demonstrate the Feature</p>
                  <p className="text-sm">
                    Show how the feature works. Your clicks and typing will be highlighted with zoom effects.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Button 
                variant="secondary" 
                onClick={() => router.back()}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => setShowInstructions(false)}
                className="flex-1"
              >
                I&apos;ve Hidden My Cursor
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold">Record Feature Demo</h1>
          </div>

          {state.status === "recording" && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-red-400">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="font-mono">{formatTime(state.recordingTime)}</span>
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={stopRecording}
              >
                Stop Recording
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Countdown Overlay */}
        {state.status === "countdown" && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-40">
            <div className="text-center">
              <div className="text-9xl font-bold text-white animate-pulse">
                {state.countdown}
              </div>
              <p className="text-xl text-gray-400 mt-4">Get ready...</p>
            </div>
          </div>
        )}

        {/* Recording/Preview Area */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Video Area */}
          <div className="lg:col-span-2">
            <Card className="aspect-video bg-black overflow-hidden flex items-center justify-center relative">
              {state.status === "idle" && !showInstructions && (
                <div className="text-center p-8">
                  <div className="text-6xl mb-4">📹</div>
                  <h3 className="text-xl font-semibold mb-2">Ready to Record</h3>
                  <p className="text-gray-400 mb-6">
                    Click the button below to start recording your screen.
                  </p>
                  <Button size="lg" onClick={startCountdown}>
                    Start Recording
                  </Button>
                </div>
              )}

              {state.status === "recording" && (
                <div className="text-center">
                  <div className="w-20 h-20 border-4 border-red-500 rounded-full flex items-center justify-center mb-4">
                    <div className="w-12 h-12 bg-red-500 rounded-full animate-pulse" />
                  </div>
                  <p className="text-xl font-semibold">Recording...</p>
                  <p className="text-gray-400 mt-2">
                    {formatTime(state.recordingTime)}
                  </p>
                </div>
              )}

              {(state.status === "preview" || state.status === "saving") && videoUrl && (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="w-full h-full"
                  autoPlay
                />
              )}

              {state.status === "error" && (
                <div className="text-center p-8">
                  <div className="text-6xl mb-4">❌</div>
                  <h3 className="text-xl font-semibold text-red-400 mb-2">Error</h3>
                  <p className="text-gray-400 mb-6">{state.error}</p>
                  <Button onClick={handleDiscard}>Try Again</Button>
                </div>
              )}
            </Card>

            {/* Recording Info */}
            {state.status === "recording" && (
              <div className="mt-4 p-4 bg-gray-900 rounded-lg">
                <p className="text-sm text-gray-400">
                  💡 Tip: Click "Stop Recording" when you&apos;re done, or stop sharing your screen.
                </p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="space-y-6">
            {(state.status === "preview" || state.status === "saving") && (
              <>
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Feature Details</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Feature Name *
                      </label>
                      <input
                        type="text"
                        value={featureName}
                        onChange={(e) => setFeatureName(e.target.value)}
                        placeholder="e.g., Smart Search Feature"
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Description
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Briefly describe what this feature does..."
                        rows={3}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Recording Info</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Duration:</span>
                      <span>{formatTime(state.recordingTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Format:</span>
                      <span>WebM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Cursor:</span>
                      <span>Tracked</span>
                    </div>
                  </div>
                </Card>

                <div className="flex gap-3">
                  <Button 
                    variant="secondary" 
                    onClick={handleDiscard}
                    className="flex-1"
                    disabled={state.status === "saving"}
                  >
                    Discard
                  </Button>
                  <Button 
                    onClick={handleSave}
                    className="flex-1"
                    disabled={!featureName.trim() || state.status === "saving"}
                  >
                    {state.status === "saving" ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Saving...
                      </>
                    ) : (
                      "Save & Edit"
                    )}
                  </Button>
                </div>
              </>
            )}

            {state.status === "idle" && !showInstructions && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Recording Tips</h3>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400">•</span>
                    Keep your demonstration under 60 seconds
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400">•</span>
                    Focus on one feature at a time
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400">•</span>
                    Move your cursor smoothly (avoid rapid movements)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400">•</span>
                    Click clearly and pause briefly after each click
                  </li>
                </ul>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function RecordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><Spinner size="lg" /></div>}>
      <RecordPageContent />
    </Suspense>
  );
}
