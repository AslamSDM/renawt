"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Player } from "@remotion/player";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Audio,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";
import type { VideoScript, VideoScene, ScreenRecording, ZoomPoint } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AudioSelector, AudioFile } from "@/components/audio/AudioSelector";
import {
  Download, Copy, Loader2, Menu, X, Video, Monitor, Upload,
  Laptop, Globe, Minus, Plus, ChevronUp, ChevronDown, Trash2,
  GripVertical, Send, Play, Pause, Image as ImageIcon,
  LayoutTemplate, Eye, EyeOff, Maximize2, ChevronLeft, ChevronRight,
  ArrowLeft, Save, Edit2, Clock
} from "lucide-react";
import { CursorTracker, detectZoomPoints } from "@/lib/recording/cursorTracker";
import { toast } from "sonner";

import { ScreenshotSelector } from "@/components/screenshot/ScreenshotSelector";

// Load Google Fonts
const { fontFamily: interFont } = loadInter("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

const { fontFamily: poppinsFont } = loadPoppins("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

const { fontFamily: robotoFont } = loadRoboto("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin"],
});

// Progress Bar Component
const ProgressBar: React.FC<{ progress: number; status: string; showPercentage?: boolean }> = ({
  progress,
  status,
  showPercentage = true
}) => {
  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{status}</span>
        {showPercentage && (
          <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
        )}
      </div>
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
        />
      </div>
    </div>
  );
};

// Typography Components
const TypingText: React.FC<{
  text: string;
  fontSize?: number;
  delay?: number;
  color?: string;
  fontFamily?: string;
  speed?: number;
  cursor?: boolean;
}> = ({
  text,
  fontSize = 72,
  delay = 0,
  color = "#ffffff",
  fontFamily = poppinsFont,
  speed = 2,
  cursor = true
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const charsToShow = Math.floor(f / speed);
  const displayText = text.slice(0, Math.min(charsToShow, text.length));
  const cursorVisible = cursor && (frame % fps < fps / 2);

  return (
    <span style={{ fontSize, fontWeight: 700, fontFamily, color, lineHeight: 1.1, letterSpacing: "-0.02em", display: "inline-block" }}>
      {displayText}
      {cursorVisible && charsToShow < text.length && <span style={{ opacity: 0.8 }}>|</span>}
    </span>
  );
};

const BlurInText: React.FC<{
  text: string;
  fontSize?: number;
  delay?: number;
  color?: string;
  fontFamily?: string;
}> = ({
  text,
  fontSize = 96,
  delay = 0,
  color = "#ffffff",
  fontFamily = poppinsFont
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const scale = spring({ frame: f, fps, config: { damping: 15, stiffness: 100 }, from: 0.8, to: 1 });
  const opacity = interpolate(f, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const blur = interpolate(f, [0, 20], [20, 0], { extrapolateRight: "clamp" });
  const y = interpolate(f, [0, 20], [40, 0], { extrapolateRight: "clamp" });

  return (
    <span style={{ fontSize, fontWeight: 800, fontFamily, color, opacity, filter: `blur(${blur}px)`,
      transform: `translateY(${y}px) scale(${scale})`, display: "inline-block", lineHeight: 1.1, letterSpacing: "-0.03em" }}>
      {text}
    </span>
  );
};

const WordReveal: React.FC<{
  text: string;
  fontSize?: number;
  delay?: number;
  color?: string;
  fontFamily?: string;
  staggerDelay?: number;
}> = ({
  text,
  fontSize = 48,
  delay = 0,
  color = "#ffffff",
  fontFamily = interFont,
  staggerDelay = 8
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4em", justifyContent: "center", fontSize, fontFamily, color, lineHeight: 1.3, fontWeight: 600 }}>
      {words.map((word, i) => {
        const f = Math.max(0, frame - delay - i * staggerDelay);
        const opacity = interpolate(f, [0, 15], [0, 1], { extrapolateRight: "clamp" });
        const y = interpolate(f, [0, 15], [30, 0], { extrapolateRight: "clamp" });
        const scale = spring({ frame: f, fps, config: { damping: 12, stiffness: 150 }, from: 0.5, to: 1 });
        return (
          <span key={i} style={{ opacity, transform: `translateY(${y}px) scale(${scale})`, display: "inline-block" }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};

const BodyText: React.FC<{
  text: string;
  fontSize?: number;
  delay?: number;
  color?: string;
  fontFamily?: string;
}> = ({
  text,
  fontSize = 28,
  delay = 0,
  color = "#e0e0e0",
  fontFamily = interFont
}) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const opacity = interpolate(f, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(f, [0, 20], [20, 0], { extrapolateRight: "clamp" });

  return (
    <p style={{ fontSize, fontFamily, color, opacity, transform: `translateY(${y}px)`, lineHeight: 1.5, fontWeight: 400, letterSpacing: "0.01em", margin: 0 }}>
      {text}
    </p>
  );
};

const GradientBackground: React.FC<{ colors: string[]; animated?: boolean }> = ({ colors, animated = true }) => {
  const frame = useCurrentFrame();
  const angle = animated ? interpolate(frame, [0, 300], [0, 360]) : 45;
  return <AbsoluteFill style={{ background: `linear-gradient(${angle}deg, ${colors.join(", ")})` }} />;
};

// Scene Preview Component - Shows rough video preview
const ScenePreview: React.FC<{ scene: VideoScene; isActive?: boolean }> = ({ scene, isActive }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneDuration = scene.endFrame - scene.startFrame;
  const isLastScene = frame > sceneDuration - 30;
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [sceneDuration - 20, sceneDuration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);
  const isIntro = scene.type === "intro";
  const isCTA = scene.type === "cta";

  // Show recording preview if scene has recording
  const hasRecording = scene.content.recordingId;
  const hasScreenshot = scene.content.screenshotUrl;

  return (
    <AbsoluteFill style={{ opacity, backgroundColor: scene.style.background || "#0a0a0a" }}>
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "60px 100px", textAlign: "center", gap: "32px", height: "100%"
      }}>
        {/* Scene Type Badge */}
        <div style={{
          padding: "6px 12px", borderRadius: "4px", background: "rgba(255,255,255,0.1)",
          fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.1em",
          color: scene.style.textColor || "#ffffff"
        }}>
          {scene.type}
        </div>

        {/* Screenshot Preview */}
        {hasScreenshot && (
          <div style={{ maxWidth: "600px", borderRadius: "12px", overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
            <img src={scene.content.screenshotUrl} alt="Screenshot" style={{ width: "100%", height: "auto" }} />
          </div>
        )}

        {/* Recording Preview Placeholder */}
        {hasRecording && !hasScreenshot && (
          <div style={{
            width: "600px", height: "340px", background: "#1a1a2e", borderRadius: "12px",
            display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed rgba(255,255,255,0.2)"
          }}>
            <div style={{ textAlign: "center", color: scene.style.textColor || "#ffffff" }}>
              <Video style={{ width: "48px", height: "48px", margin: "0 auto 16px", opacity: 0.5 }} />
              <p style={{ fontSize: "14px", opacity: 0.7 }}>Recording: {scene.content.headline}</p>
            </div>
          </div>
        )}

        {/* Main Headline */}
        {scene.content.headline && (
          <div style={{ maxWidth: "900px" }}>
            {isIntro ? (
              <BlurInText text={scene.content.headline} fontSize={72} delay={10} color={scene.style.textColor || "#ffffff"} />
            ) : (
              <WordReveal text={scene.content.headline} fontSize={48} delay={8} color={scene.style.textColor || "#ffffff"} staggerDelay={6} />
            )}
          </div>
        )}

        {/* Subtext */}
        {scene.content.subtext && (
          <div style={{ marginTop: "16px", maxWidth: "700px", opacity: isLastScene ? 0.5 : 1 }}>
            <BodyText text={scene.content.subtext} fontSize={24} delay={isIntro ? 30 : 20} color={scene.style.textColor || "#e0e0e0"} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

const SingleScenePlayer: React.FC<{ scene: VideoScene }> = ({ scene }) => {
  return (
    <Player
      component={() => <ScenePreview scene={scene} />}
      durationInFrames={scene.endFrame - scene.startFrame}
      fps={30}
      compositionWidth={1920}
      compositionHeight={1080}
      style={{ width: "100%", height: "100%" }}
      controls
      loop
    />
  );
};

const DynamicComposition: React.FC<{ script: VideoScript; audioUrl?: string | null }> = ({ script, audioUrl }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {audioUrl && <Audio src={audioUrl} volume={0.8} />}
      {script.scenes.map((scene) => (
        <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.endFrame - scene.startFrame}>
          <ScenePreview scene={scene} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const PlaceholderComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const opacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const floatY = Math.sin(frame * 0.05) * 5;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ opacity, transform: `scale(${scale}) translateY(${floatY}px)`, textAlign: "center", maxWidth: "800px", padding: "40px" }}>
        <div style={{ fontSize: "80px", marginBottom: "40px", opacity: interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" }) }}>
          🎬
        </div>
        <div style={{ marginBottom: "24px" }}>
          <TypingText text="Your Video Awaits" fontSize={72} delay={20} color="#ffffff" speed={3} cursor={true} />
        </div>
        <div style={{ opacity: interpolate(frame, [50, 70], [0, 1], { extrapolateRight: "clamp" }) }}>
          <BodyText text="Enter a description to begin production" fontSize={24} color="#666666" />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default function ProjectCreativePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  // Project states
  const [project, setProject] = useState<any>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [tempProjectName, setTempProjectName] = useState("");

  // Input states
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState<"professional" | "playful" | "minimal" | "bold">("professional");
  const [videoType, setVideoType] = useState<"demo" | "creative" | "fast-paced" | "cinematic" | "product-demo">("creative");
  const [duration, setDuration] = useState<number>(38);
  const [url, setUrl] = useState("");
  const [selectedAudio, setSelectedAudio] = useState<AudioFile | null>(null);

  // Map style to template style
  const getTemplateStyle = (selectedStyle: string): "aurora" | "floating-glass" | "blue-clean" => {
    switch (selectedStyle) {
      case "professional":
        return "aurora";
      case "playful":
        return "blue-clean";
      case "minimal":
        return "floating-glass";
      case "bold":
        return "blue-clean";
      default:
        return "aurora";
    }
  };

  // Processing states
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  // Data states
  const [script, setScript] = useState<VideoScript | null>(null);
  const [editableScript, setEditableScript] = useState<VideoScript | null>(null);
  const [productData, setProductData] = useState<any>(null);
  const [remotionCode, setRemotionCode] = useState<string | null>(null);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [renderVersion, setRenderVersion] = useState<number>(Date.now()); // Force video reload

  // Version history states
  interface VideoVersion {
    id: string;
    versionNumber: number;
    timestamp: number;
    editMessage: string;
    remotionCode: string;
    videoUrl: string | null;
    thumbnailUrl?: string;
    isActive: boolean;
  }
  const [versions, setVersions] = useState<VideoVersion[]>([]);
  const [showVersionSidebar, setShowVersionSidebar] = useState(false);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);

  // UI states
  const [activeTab, setActiveTab] = useState<"input" | "script" | "preview">("input");
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Progress states
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");
  const [isSceneUpdating, setIsSceneUpdating] = useState<string | null>(null);

  // Recording states
  const [recordings, setRecordings] = useState<ScreenRecording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [recordingFeatureName, setRecordingFeatureName] = useState("");
  const [recordingDescription, setRecordingDescription] = useState("");
  const [recordingMode, setRecordingMode] = useState<"record" | "upload">("record");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Editor states
  const [editingRecording, setEditingRecording] = useState<ScreenRecording | null>(null);
  const [editTrimStart, setEditTrimStart] = useState(0);
  const [editTrimEnd, setEditTrimEnd] = useState(0);
  const [editMockupFrame, setEditMockupFrame] = useState<"browser" | "macbook" | "minimal">("minimal");
  const [editCursorStyle, setEditCursorStyle] = useState<"normal" | "hand">("hand");

  // CV Processing states
  const [processingRecordings, setProcessingRecordings] = useState<Set<string>>(new Set());
  const [recordingProgress, setRecordingProgress] = useState<Record<string, number>>({});

  // Screenshot & Logo states
  const [scrapedScreenshots, setScrapedScreenshots] = useState<any[]>([]);
  const [extractedLogos, setExtractedLogos] = useState<any[]>([]);
  const [selectedScreenshots, setSelectedScreenshots] = useState<any[]>([]);
  const [isAnalyzingScreenshots, setIsAnalyzingScreenshots] = useState(false);

  const [scriptChatInput, setScriptChatInput] = useState("");
  const [scriptChatLoading, setScriptChatLoading] = useState(false);
  const [scriptChatHistory, setScriptChatHistory] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);

  // Post-render editing states
  const [videoEditInput, setVideoEditInput] = useState("");
  const [videoEditLoading, setVideoEditLoading] = useState(false);
  const [videoEditHistory, setVideoEditHistory] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [editProgress, setEditProgress] = useState(0);
  const [editStatus, setEditStatus] = useState("");

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cursorTrackerRef = useRef<CursorTracker | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const editVideoRef = useRef<HTMLVideoElement>(null);

  const addLog = (message: string, type: "info" | "success" | "error" = "info") => {
    const prefix = type === "success" ? "✓" : type === "error" ? "✗" : "→";
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${prefix} ${message}`]);
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Load project data on mount
  useEffect(() => {
    if (projectId) {
      loadProject();
      loadRecordings();
    }
  }, [projectId]);

  // Unified polling for recording processing status (CV detection + video processing)
  useEffect(() => {
    const pendingRecordings = recordings.filter(
      (r) => r.processingStatus === "pending" || r.processingStatus === "processing"
    );
    if (pendingRecordings.length === 0) return;

    const interval = setInterval(async () => {
      for (const rec of pendingRecordings) {
        try {
          const res = await fetch(`/api/recordings/${rec.id}/status`);
          if (!res.ok) continue;
          const data = await res.json();

          if (data.status === "not_found") {
            // Recording was never queued (e.g. loaded from DB after server restart)
            // Stop polling by marking as complete
            setRecordings((prev) =>
              prev.map((r) =>
                r.id === rec.id ? { ...r, processingStatus: "complete" } : r
              )
            );
            continue;
          }

          if (data.processedVideoUrl) {
            setRecordings((prev) =>
              prev.map((r) =>
                r.id === rec.id
                  ? { ...r, processedVideoUrl: data.processedVideoUrl, processingStatus: "complete" }
                  : r
              )
            );
            setProcessingRecordings((prev) => {
              const next = new Set(prev);
              next.delete(rec.id);
              return next;
            });
            addLog(`Processed video ready: ${rec.featureName}`, "success");
          } else if (data.status === "complete") {
            setRecordings((prev) =>
              prev.map((r) =>
                r.id === rec.id
                  ? {
                      ...r,
                      cursorData: data.cursorData || r.cursorData,
                      zoomPoints: data.zoomPoints || r.zoomPoints,
                      processingStatus: "complete",
                    }
                  : r
              )
            );
            setProcessingRecordings((prev) => {
              const next = new Set(prev);
              next.delete(rec.id);
              return next;
            });
            addLog(`Processing complete for ${rec.featureName}`, "success");
          } else if (data.status === "failed") {
            setRecordings((prev) =>
              prev.map((r) =>
                r.id === rec.id ? { ...r, processingStatus: "failed" } : r
              )
            );
            addLog(`Processing failed for ${rec.featureName}`, "error");
          } else if (data.status === "processing") {
            setRecordingProgress((prev) => ({
              ...prev,
              [rec.id]: data.progress || 0,
            }));
          }
        } catch (err) {
          console.error(`[Creative] Failed to check status for ${rec.id}:`, err);
        }
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [recordings]);

  const loadProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) throw new Error("Failed to load project");

      const data = await response.json();
      setProject(data.project);

      // Restore project state
      if (data.project.name) setProjectName(data.project.name);
      if (data.project.description) setDescription(data.project.description);
      if (data.project.sourceUrl) setUrl(data.project.sourceUrl);
      if (data.project.productData) {
        setProductData(data.project.productData);
        if (data.project.productData.screenshots) {
          setScrapedScreenshots(data.project.productData.screenshots);
          setSelectedScreenshots(data.project.productData.screenshots);
        }
      }
      if (data.project.script) {
        setScript(data.project.script);
        setEditableScript(data.project.script);
      }
      if (data.project.composition) {
        setRemotionCode(data.project.composition);
      }
      if (data.project.audioUrl) {
        setRenderedVideoUrl(data.project.audioUrl);
      }
      // Load version history from project or R2
      if (data.project.versions) {
        setVersions(data.project.versions);
        if (data.project.currentVersionId) {
          setCurrentVersionId(data.project.currentVersionId);
        }
      } else {
        // Try to load from R2 if not in project
        try {
          const versionsResponse = await fetch(`/api/versions?projectId=${projectId}`);
          if (versionsResponse.ok) {
            const versionsData = await versionsResponse.json();
            if (versionsData.versions && versionsData.versions.length > 0) {
              setVersions(versionsData.versions);
              // Find the active version
              const activeVersion = versionsData.versions.find((v: VideoVersion) => v.isActive);
              if (activeVersion) {
                setCurrentVersionId(activeVersion.id);
              }
            }
          }
        } catch (err) {
          console.warn("Failed to load versions from R2:", err);
        }
      }
    } catch (err) {
      addLog("Failed to load project", "error");
    } finally {
      setProjectLoading(false);
    }
  };

  const loadRecordings = async () => {
    try {
      const response = await fetch(`/api/recordings?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        // Recordings loaded from DB with processingStatus "pending" may not be
        // actually queued for processing (e.g. server restarted). Mark them as
        // complete if they already have a processedVideoUrl, otherwise leave as-is
        // and the polling effect will check status and handle "not_found".
        const loaded = (data.recordings || []).map((r: any) => ({
          ...r,
          processingStatus: r.processedVideoUrl ? "complete" : r.processingStatus,
        }));
        setRecordings(loaded);
      }
    } catch (err) {
      console.error("Failed to load recordings:", err);
    }
  };

  const saveProject = async (updates: any) => {
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error("Failed to save project:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleProjectNameSave = async () => {
    if (!tempProjectName.trim()) {
      setEditingProjectName(false);
      return;
    }

    const newName = tempProjectName.trim();
    setProjectName(newName);
    setEditingProjectName(false);
    await saveProject({ name: newName });
  };

  const startEditingProjectName = () => {
    setTempProjectName(projectName);
    setEditingProjectName(true);
  };

  const handleGenerate = async () => {
    if (!description.trim() && !url.trim()) {
      toast.error("Please enter a URL or description");
      return;
    }

    setLoading(true);
    setLogs([]);
    setScript(null);
    setRemotionCode(null);
    setRenderedVideoUrl(null);
    setActiveTab("script");
    setGenerationProgress(5);
    setGenerationStatus("Initializing AI...");

    addLog(`Generating script for "${description}"...`);
    addLog(`Style: ${style} (${getTemplateStyle(style)}), Type: ${videoType}`);

    try {
      const response = await fetch("/api/creative/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          style,
          templateStyle: getTemplateStyle(style),
          videoType,
          duration,
          url: url.trim() || undefined,
          projectId,
          audio: selectedAudio ? { url: selectedAudio.url, bpm: selectedAudio.bpm, duration: selectedAudio.duration } : undefined,
          recordings: recordings.length > 0 ? recordings.map(r => ({
            id: r.id, videoUrl: r.videoUrl, duration: r.duration, featureName: r.featureName,
            description: r.description, trimStart: r.trimStart, trimEnd: r.trimEnd,
            mockupFrame: r.mockupFrame || "minimal", zoomPoints: r.zoomPoints || [],
            cursorStyle: r.cursorStyle || "hand", cursorData: r.cursorData || [],
            cursorSource: r.cursorSource || "javascript",
            processedVideoUrl: r.processedVideoUrl,
          })) : undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 402) {
          throw new Error(errData.error || "Insufficient credits");
        }
        throw new Error(errData.error || "API request failed");
      }
      setGenerationProgress(15);
      setGenerationStatus("Processing request...");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            switch (event.type) {
              case "status":
                addLog(`${event.data.message || event.data.step}`);
                // Update progress based on status messages
                const message = (event.data.message || event.data.step || "").toLowerCase();
                if (message.includes("extracting") || message.includes("scraping")) {
                  setGenerationProgress(25);
                  setGenerationStatus("Extracting product data...");
                } else if (message.includes("analyzing") || message.includes("processing")) {
                  setGenerationProgress(35);
                  setGenerationStatus("Analyzing content...");
                } else if (message.includes("generating") || message.includes("creating")) {
                  setGenerationProgress(60);
                  setGenerationStatus("Generating video script...");
                } else if (message.includes("finalizing") || message.includes("optimizing")) {
                  setGenerationProgress(85);
                  setGenerationStatus("Finalizing script...");
                }
                break;
              case "productData":
                setProductData(event.data);
                await saveProject({ productData: event.data, sourceUrl: url });

                // Extract screenshots and logos from product data
                if (event.data.screenshots?.length > 0) {
                  setScrapedScreenshots(event.data.screenshots);
                  setSelectedScreenshots(event.data.screenshots); // Default select all
                  addLog(`${event.data.screenshots.length} screenshots captured`, "success");
                }

                if (event.data.logos?.length > 0) {
                  setExtractedLogos(event.data.logos);
                  addLog(`${event.data.logos.length} logos extracted`, "success");
                }

                setGenerationProgress(35);
                setGenerationStatus("Product data extracted");
                addLog("Product data extracted", "success");
                break;
              case "videoScript":
                setScript(event.data);
                setEditableScript(event.data);
                await saveProject({ script: event.data, description, status: "DRAFT" });
                setGenerationProgress(100);
                setGenerationStatus("Script generation complete!");
                addLog(`Script created with ${event.data.scenes?.length || 0} scenes`, "success");
                break;
              case "remotionCode":
                setRemotionCode(event.data);
                addLog("Video composition ready", "success");
                break;
              case "videoUrl":
                setRenderedVideoUrl(event.data);
                addLog("Video rendered successfully!", "success");
                break;
              case "error":
                toast.error(event.data.errors?.join(", ") || "Unknown error");
                addLog(event.data.errors?.[0] || "Error occurred", "error");
                break;
              case "complete":
                addLog("Production complete!", "success");
                break;
            }
          } catch (e) {
            console.warn("Failed to parse event:", line);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(message);
      addLog(message, "error");
    } finally {
      setLoading(false);
      setGenerationProgress(0);
      setGenerationStatus("");
    }
  };

  const handleContinueGeneration = useCallback(async () => {
    if (!editableScript) return;
    setLoading(true);
    setScript(editableScript);
    setGenerationProgress(0);
    setGenerationStatus("Initializing video generation...");
    addLog("Starting video production...");

    try {
      const response = await fetch("/api/creative/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoScript: editableScript,
          productData,
          projectId,
          userPreferences: { style, templateStyle: getTemplateStyle(style), videoType, duration, audio: selectedAudio ? { url: selectedAudio.url, bpm: selectedAudio.bpm, duration: selectedAudio.duration } : undefined },
          recordings: recordings.length > 0 ? recordings.map(r => ({
            id: r.id, videoUrl: r.videoUrl, duration: r.duration, featureName: r.featureName,
            description: r.description, trimStart: r.trimStart, trimEnd: r.trimEnd,
            mockupFrame: r.mockupFrame || "minimal", zoomPoints: r.zoomPoints || [],
            cursorStyle: r.cursorStyle || "hand",
            cursorData: r.cursorData || [],
            cursorSource: r.cursorSource || "javascript",
            processedVideoUrl: r.processedVideoUrl,
          })) : undefined,
        }),
      });

      if (!response.ok) throw new Error("Continue API request failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            switch (event.type) {
              case "status":
                addLog(`${event.data.message || event.data.step}`);
                // Update progress based on status messages
                const message = (event.data.message || event.data.step || "").toLowerCase();
                if (message.includes("generating code") || message.includes("creating")) {
                  setGenerationProgress(25);
                  setGenerationStatus("Preparing video composition...");
                } else if (message.includes("rendering") || message.includes("processing")) {
                  setGenerationProgress(60);
                  setGenerationStatus("Rendering video...");
                } else if (message.includes("finalizing") || message.includes("encoding")) {
                  setGenerationProgress(85);
                  setGenerationStatus("Finalizing video...");
                }
                break;
              case "remotionCode":
                setRemotionCode(event.data);
                await saveProject({ composition: event.data, status: "GENERATING" });
                setGenerationProgress(50);
                setGenerationStatus("Composition ready, rendering video...");
                addLog("Video composition ready", "success");
                break;
              case "videoUrl":
                setRenderedVideoUrl(event.data);
                await saveProject({ audioUrl: event.data, status: "READY" });
                setGenerationProgress(100);
                setGenerationStatus("Video generation complete!");
                setActiveTab("preview");
                addLog("Video rendered successfully!", "success");
                break;
              case "error":
                toast.error(event.data.errors?.join(", ") || "Unknown error");
                addLog(event.data.errors?.[0] || "Error occurred", "error");
                break;
              case "complete":
                setGenerationProgress(100);
                setGenerationStatus("Complete!");
                addLog("Production complete!", "success");
                break;
            }
          } catch (e) {
            console.warn("Failed to parse event:", line);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(message);
      addLog(message, "error");
    } finally {
      setLoading(false);
      setGenerationProgress(0);
      setGenerationStatus("");
    }
  }, [editableScript, productData, style, videoType, duration, selectedAudio, recordings, projectId]);

  // Re-render video after editing
  const handleReRender = useCallback(async () => {
    if (!remotionCode) return;

    setLoading(true);
    setGenerationProgress(0);
    setGenerationStatus("Applying changes and re-rendering...");
    addLog("Updating video with your changes...");

    try {
      const response = await fetch("/api/creative/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remotionCode,
          projectId,
          audio: selectedAudio ? { url: selectedAudio.url, bpm: selectedAudio.bpm, duration: selectedAudio.duration } : undefined,
          durationInFrames: editableScript?.totalDuration || 300,
        }),
      });

      if (!response.ok) throw new Error("Re-render API request failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            switch (event.type) {
              case "status":
                setGenerationStatus(event.data.message || "Rendering...");
                if (event.data.progress) setGenerationProgress(event.data.progress);
                break;
              case "videoUrl":
                const newVideoUrl = event.data;
                setRenderedVideoUrl(newVideoUrl);
                setRenderVersion(Date.now());
                await saveProject({ audioUrl: newVideoUrl, status: "READY" });

                const newVersion: VideoVersion = {
                  id: `v-${Date.now()}`,
                  versionNumber: versions.length + 1,
                  timestamp: Date.now(),
                  editMessage: videoEditHistory[videoEditHistory.length - 1]?.text || "Manual re-render",
                  remotionCode: remotionCode || "",
                  videoUrl: newVideoUrl,
                  isActive: true,
                };

                const updatedVersions = versions.map(v => ({ ...v, isActive: false }));
                updatedVersions.push(newVersion);
                setVersions(updatedVersions);
                setCurrentVersionId(newVersion.id);

                await saveProject({ versions: updatedVersions });

                try {
                  await fetch("/api/versions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ projectId, versions: updatedVersions }),
                  });
                } catch (err) {
                  console.warn("Failed to save versions to R2:", err);
                }

                setGenerationProgress(100);
                setGenerationStatus("Re-render complete!");
                addLog("Video re-rendered successfully!", "success");
                break;
              case "error":
                toast.error(event.data.errors?.join(", ") || "Unknown error");
                addLog(event.data.errors?.[0] || "Render error occurred", "error");
                break;
            }
          } catch (e) {
            console.warn("Failed to parse event:", line);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(message);
      addLog(message, "error");
    } finally {
      setLoading(false);
    }
  }, [remotionCode, projectId, selectedAudio, editableScript, versions, videoEditHistory]);

  // Post-render video editing via chat
  const handleVideoEdit = useCallback(async () => {
    if (!videoEditInput.trim() || !remotionCode || videoEditLoading) return;

    const message = videoEditInput.trim();
    setVideoEditInput("");
    setVideoEditLoading(true);
    setEditProgress(10);
    setEditStatus("Analyzing edit request...");
    setVideoEditHistory(prev => [...prev, { role: "user", text: message }]);

    addLog(`Editing video: "${message}"`, "info");

    try {
      const response = await fetch("/api/creative/edit-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          remotionCode,
          videoScript: editableScript,
          productData,
          userPreferences: { style, videoType, duration, audio: selectedAudio ? { url: selectedAudio.url, bpm: selectedAudio.bpm, duration: selectedAudio.duration } : undefined },
          recordings: recordings.map(r => ({
            id: r.id, videoUrl: r.videoUrl, duration: r.duration, featureName: r.featureName,
            description: r.description, trimStart: r.trimStart, trimEnd: r.trimEnd,
            mockupFrame: r.mockupFrame || "minimal", zoomPoints: r.zoomPoints || [],
            cursorStyle: r.cursorStyle || "hand", cursorData: r.cursorData || [],
            processedVideoUrl: r.processedVideoUrl,
          })),
        }),
      });

      if (!response.ok) throw new Error("Edit API request failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let newRemotionCode: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            switch (event.type) {
              case "status":
                const step = event.data.step;
                setEditStatus(event.data.message);
                if (step === "editing") setEditProgress(30);
                else if (step === "generating") setEditProgress(50);
                else if (step === "validating") setEditProgress(70);
                else if (step === "fixing") setEditProgress(80);
                else if (step === "complete") setEditProgress(90);
                break;
              case "remotionCode":
                newRemotionCode = event.data;
                setRemotionCode(event.data);
                await saveProject({ composition: event.data, status: "EDITING" });
                setEditProgress(100);
                break;
              case "error":
                toast.error(event.data.errors?.join(", ") || "Unknown error");
                addLog(event.data.errors?.[0] || "Edit error occurred", "error");
                break;
              case "complete":
                if (event.data.success && newRemotionCode) {
                  setVideoEditHistory(prev => [...prev, { role: "assistant", text: "Applying changes and re-rendering..." }]);
                  addLog("Changes applied, updating video...", "success");
                } else {
                  setVideoEditHistory(prev => [...prev, { role: "assistant", text: "Edit completed with issues. Please try a different request." }]);
                }
                break;
            }
          } catch (e) {
            console.warn("Failed to parse event:", line);
          }
        }
      }
      // Auto-render after successful edit
      if (newRemotionCode) {
        setTimeout(() => handleReRender(), 500);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(message);
      addLog(message, "error");
      setVideoEditHistory(prev => [...prev, { role: "assistant", text: `Error: ${message}` }]);
    } finally {
      setVideoEditLoading(false);
    }
  }, [videoEditInput, remotionCode, editableScript, productData, style, videoType, duration, selectedAudio, recordings, projectId, videoEditLoading, handleReRender]);

  // Switch to a specific version
  const switchToVersion = useCallback(async (version: VideoVersion) => {
    setRemotionCode(version.remotionCode);
    setRenderedVideoUrl(version.videoUrl);
    setRenderVersion(Date.now());
    setCurrentVersionId(version.id);
    
    // Mark this version as active
    const updatedVersions = versions.map(v => ({
      ...v,
      isActive: v.id === version.id
    }));
    setVersions(updatedVersions);
    
    await saveProject({ 
      composition: version.remotionCode,
      audioUrl: version.videoUrl,
      versions: updatedVersions,
      currentVersionId: version.id 
    });
    
    addLog(`Switched to version ${version.versionNumber}`, "success");
  }, [versions]);

  const handleRender = async () => {
    if (!remotionCode) {
      toast.error("No video composition available. Generate a video first!");
      return;
    }
    setRendering(true);
    setRenderProgress(5);
    setGenerationStatus("Initializing render...");
    addLog("Starting render...");

    let progressStage = 0;
    const progressInterval = setInterval(() => {
      progressStage++;
      if (progressStage === 1) {
        setRenderProgress(20);
        setGenerationStatus("Preparing composition...");
      } else if (progressStage === 2) {
        setRenderProgress(40);
        setGenerationStatus("Rendering frames...");
      } else if (progressStage === 3) {
        setRenderProgress(60);
        setGenerationStatus("Encoding video...");
      } else if (progressStage === 4) {
        setRenderProgress(80);
        setGenerationStatus("Finalizing output...");
      } else if (progressStage >= 5) {
        setRenderProgress((prev) => Math.min(prev + 2, 95));
      }
    }, 2000);

    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remotionCode, durationInFrames: script?.totalDuration || 300, format: "mp4" }),
      });

      clearInterval(progressInterval);
      const result = await response.json();

      if (result.success) {
        setRenderProgress(100);
        setGenerationStatus("Render complete!");
        setRenderedVideoUrl(result.videoUrl);
        addLog(`Video rendered in ${Math.round(result.renderTime / 1000)}s`, "success");
      } else {
        throw new Error(result.error || "Render failed");
      }
    } catch (err) {
      clearInterval(progressInterval);
      const message = err instanceof Error ? err.message : "Render failed";
      toast.error(message);
      addLog(`Render error: ${message}`, "error");
    } finally {
      setRendering(false);
      setTimeout(() => {
        setGenerationStatus("");
      }, 2000);
    }
  };

  // Scene editing handlers
  const handleUpdateScene = useCallback((sceneId: string, updates: Partial<VideoScene>) => {
    setEditableScript(prev => {
      if (!prev) return prev;
      const scenes = prev.scenes.map(s => s.id === sceneId ? { ...s, ...updates } : s);
      let frame = 0;
      for (const scene of scenes) {
        const duration = scene.endFrame - scene.startFrame;
        scene.startFrame = frame;
        scene.endFrame = frame + duration;
        frame += duration;
      }
      const updated = { ...prev, scenes, totalDuration: frame };
      saveProject({ script: updated });
      return updated;
    });
  }, []);

  const handleRemoveScene = useCallback((sceneId: string) => {
    setEditableScript(prev => {
      if (!prev) return prev;
      const scenes = prev.scenes.filter(s => s.id !== sceneId);
      let frame = 0;
      for (const scene of scenes) {
        const duration = scene.endFrame - scene.startFrame;
        scene.startFrame = frame;
        scene.endFrame = frame + duration;
        frame += duration;
      }
      const updated = { ...prev, scenes, totalDuration: frame };
      saveProject({ script: updated });
      return updated;
    });
  }, []);

  const handleReorderScene = useCallback((fromIdx: number, toIdx: number) => {
    setEditableScript(prev => {
      if (!prev) return prev;
      const scenes = [...prev.scenes];
      const [moved] = scenes.splice(fromIdx, 1);
      scenes.splice(toIdx, 0, moved);
      let frame = 0;
      for (const scene of scenes) {
        const duration = scene.endFrame - scene.startFrame;
        scene.startFrame = frame;
        scene.endFrame = frame + duration;
        frame += duration;
      }
      const updated = { ...prev, scenes, totalDuration: frame };
      saveProject({ script: updated });
      return updated;
    });
  }, []);

  const handleAddScene = useCallback(() => {
    setEditableScript(prev => {
      if (!prev) return prev;
      const scenes = [...prev.scenes];
      const newScene: VideoScene = {
        id: `scene-${Date.now()}`, startFrame: 0, endFrame: 60, type: "feature",
        content: { headline: "New Feature", subtext: "" },
        animation: { enter: "blur-in" as any, exit: "fade" },
        style: { background: "#0a0a0f", textColor: "#ffffff", fontSize: "medium" },
      };
      scenes.push(newScene);
      let frame = 0;
      for (const scene of scenes) {
        const duration = scene.endFrame - scene.startFrame;
        scene.startFrame = frame;
        scene.endFrame = frame + duration;
        frame += duration;
      }
      const updated = { ...prev, scenes, totalDuration: frame };
      saveProject({ script: updated });
      return updated;
    });
  }, []);

  const handleAddRecordingToScene = useCallback((sceneId: string, recording: ScreenRecording) => {
    setEditableScript(prev => {
      if (!prev) return prev;
      const scenes = prev.scenes.map(s =>
        s.id === sceneId ? {
          ...s,
          type: "recording" as const,
          content: { ...s.content, recordingId: recording.id, headline: recording.featureName }
        } : s
      );
      return { ...prev, scenes };
    });
  }, []);

  const handleAddScreenshotToScene = useCallback((sceneId: string, screenshotUrl: string) => {
    setEditableScript(prev => {
      if (!prev) return prev;
      const scenes = prev.scenes.map(s =>
        s.id === sceneId ? {
          ...s,
          type: "screenshot" as const,
          content: { ...s.content, screenshotUrl }
        } : s
      );
      return { ...prev, scenes };
    });
  }, []);

  const handleScriptChat = useCallback(async () => {
    if (!scriptChatInput.trim() || !editableScript || scriptChatLoading) return;
    const message = scriptChatInput.trim();
    setScriptChatInput("");
    setScriptChatLoading(true);
    setScriptChatHistory(prev => [...prev, { role: "user", text: message }]);

    try {
      const response = await fetch("/api/creative/edit-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, videoScript: editableScript, productData }),
      });

      const data = await response.json();
      if (data.success && data.videoScript) {
        setEditableScript(data.videoScript);
        setScript(data.videoScript);
        await saveProject({ script: data.videoScript });
        const reply = `Updated — ${data.videoScript.scenes?.length || 0} scenes.`;
        setScriptChatHistory(prev => [...prev, { role: "assistant", text: reply }]);
        addLog(`Script edited: "${message}"`, "success");
      } else {
        setScriptChatHistory(prev => [...prev, { role: "assistant", text: `Error: ${data.error || "Failed"}` }]);
      }
    } catch (err) {
      setScriptChatHistory(prev => [...prev, { role: "assistant", text: "Error: Network failed" }]);
    } finally {
      setScriptChatLoading(false);
    }
  }, [scriptChatInput, editableScript, productData, scriptChatLoading]);

  // Recording functions
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: false,
      });

      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const cursorData = cursorTrackerRef.current?.stop() || [];
        const zoomPoints = detectZoomPoints(cursorData);

        const formData = new FormData();
        formData.append("video", blob, "recording.webm");
        formData.append("projectId", projectId);
        formData.append("cursorData", JSON.stringify(cursorData));
        formData.append("zoomPoints", JSON.stringify(zoomPoints));
        formData.append("featureName", recordingFeatureName || "Feature Demo");
        formData.append("description", recordingDescription || "");
        formData.append("duration", String(recordingTime));
        formData.append("cursorStyle", editCursorStyle);

        try {
          const response = await fetch("/api/recordings", { method: "POST", body: formData });
          const data = await response.json();
          if (data.success) {
            addLog(`Recording saved: ${recordingFeatureName || "Feature Demo"}`, "success");

            // Check if CV processing was triggered (for external recordings)
            const isExternalRecording = cursorData.length === 0;

            const newRecording: ScreenRecording = {
              id: data.recordingId, projectId, videoUrl: data.videoUrl,
              duration: recordingTime, cursorData, zoomPoints, trimStart: 0, trimEnd: recordingTime,
              featureName: recordingFeatureName || "Feature Demo", description: recordingDescription || "",
              cursorStyle: editCursorStyle, mockupFrame: "minimal", createdAt: new Date().toISOString(),
              cursorSource: isExternalRecording ? "cv_detection" : "javascript",
              processingStatus: "pending",
            };
            setEditingRecording(newRecording);
            setEditTrimStart(0);
            setEditTrimEnd(recordingTime);
            setEditMockupFrame("minimal");
            loadRecordings(); // Refresh recordings list
          } else {
            addLog(`Recording upload failed: ${data.error || "Unknown error"}`, "error");
          }
        } catch (error) {
          addLog(`Failed to save recording`, "error");
        }
        setIsRecording(false);
      };

      cursorTrackerRef.current = new CursorTracker();
      cursorTrackerRef.current.start();
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds++;
        setRecordingTime(seconds);
      }, 1000);

      stream.getVideoTracks()[0].onended = () => stopRecording();
    } catch (error) {
      addLog("Failed to start recording", "error");
    }
  }, [recordingFeatureName, recordingDescription, recordingTime, projectId, editCursorStyle]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (cursorTrackerRef.current) cursorTrackerRef.current.stop();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleUpload = useCallback(async () => {
    if (!uploadFile || !recordingFeatureName.trim()) return;
    setUploading(true);
    try {
      // Get video duration from file metadata
      const videoDuration = await new Promise<number>((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => { resolve(video.duration); URL.revokeObjectURL(video.src); };
        video.onerror = () => { resolve(30); URL.revokeObjectURL(video.src); };
        video.src = URL.createObjectURL(uploadFile);
      });

      const formData = new FormData();
      formData.append("video", uploadFile);
      formData.append("projectId", projectId);
      formData.append("cursorData", "[]");
      formData.append("zoomPoints", "[]");
      formData.append("featureName", recordingFeatureName);
      formData.append("description", recordingDescription || "");
      formData.append("duration", String(Math.round(videoDuration)));
      formData.append("cursorStyle", editCursorStyle);

      const response = await fetch("/api/recordings", { method: "POST", body: formData });
      const data = await response.json();
      if (data.success) {
        const newRecording: ScreenRecording = {
          id: data.recordingId, projectId, videoUrl: data.videoUrl,
          duration: videoDuration, cursorData: [], zoomPoints: [], trimStart: 0, trimEnd: videoDuration,
          featureName: recordingFeatureName, description: recordingDescription || "",
          cursorStyle: editCursorStyle, mockupFrame: "minimal", createdAt: new Date().toISOString(),
          processingStatus: "pending",
        };
        setEditingRecording(newRecording);
        setEditTrimStart(0);
        setEditTrimEnd(videoDuration);
        setEditMockupFrame("minimal");
        loadRecordings();
        addLog(`Upload complete: ${recordingFeatureName}`, "success");
      } else {
        addLog(`Upload failed: ${data.error || "Unknown error"}`, "error");
      }
    } catch (error) {
      addLog("Failed to upload recording", "error");
    } finally {
      setUploading(false);
      setUploadFile(null);
    }
  }, [uploadFile, recordingFeatureName, recordingDescription, projectId, editCursorStyle]);

  const handleSaveRecordingEdit = useCallback(() => {
    if (!editingRecording) return;
    const updated: ScreenRecording = {
      ...editingRecording, trimStart: editTrimStart, trimEnd: editTrimEnd, mockupFrame: editMockupFrame, cursorStyle: editCursorStyle,
    };
    setRecordings(prev => {
      const exists = prev.find(r => r.id === updated.id);
      if (exists) return prev.map(r => r.id === updated.id ? updated : r);
      return [...prev, updated];
    });
    addLog(`Recording saved: ${updated.featureName}`, "success");
    setEditingRecording(null);
    setRecordingFeatureName("");
    setRecordingDescription("");
    setShowRecordingModal(false);
  }, [editingRecording, editTrimStart, editTrimEnd, editMockupFrame, editCursorStyle]);

  // Composition
  const CompositionComponent = editableScript
    ? () => <DynamicComposition script={editableScript} audioUrl={selectedAudio?.url || null} />
    : PlaceholderComposition;
  const totalDuration = editableScript?.totalDuration || 300;

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 px-6 py-4 flex items-center justify-between bg-[#0a0a0a]/80 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-4">
          <Link href="/projects" className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Link href="/" className="text-xl font-light tracking-[0.2em] uppercase">Remawt</Link>
          <span className="text-gray-600">/</span>

          {/* Project Name - Editable */}
          {editingProjectName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tempProjectName}
                onChange={(e) => setTempProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleProjectNameSave();
                  if (e.key === "Escape") setEditingProjectName(false);
                }}
                onBlur={handleProjectNameSave}
                className="px-2 py-1 bg-white/10 border border-white/20 rounded text-sm focus:outline-none focus:border-white/40 w-48"
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={startEditingProjectName}
              className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 group"
            >
              <span className="truncate max-w-xs">{projectName || "Untitled Project"}</span>
              <Edit2 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          {saving && (
            <span className="text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving...
            </span>
          )}
          <Link href="/projects" className="text-sm text-gray-400 hover:text-white transition-colors">
            All Projects
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20">
        {/* Progress Steps */}
        <div className="border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              {[
                { id: "input", label: "1. Configure", icon: LayoutTemplate },
                { id: "script", label: "2. Review Script", icon: Eye },
                { id: "preview", label: "3. Final Preview", icon: Video },
              ].map((step, idx) => {
                const Icon = step.icon;
                const isActive = activeTab === step.id;
                const isPast = idx < ["input", "script", "preview"].indexOf(activeTab);
                return (
                  <button
                    key={step.id}
                    onClick={() => setActiveTab(step.id as any)}
                    disabled={step.id === "script" && !editableScript || step.id === "preview" && !renderedVideoUrl}
                    className={`flex items-center gap-2 px-4 py-2 text-sm transition-all ${
                      isActive ? "text-white bg-white/10 rounded-lg" :
                      isPast ? "text-green-400" : "text-gray-500"
                    } ${step.id === "script" && !editableScript || step.id === "preview" && !renderedVideoUrl ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden md:inline">{step.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* INPUT TAB - Wider Configuration Panel */}
        {activeTab === "input" && (
          <div className="max-w-6xl mx-auto px-6 py-12">
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Left Column - Inputs */}
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-light mb-2">Create Your Video</h2>
                  <p className="text-gray-500">Enter your product details and we'll generate a script</p>
                </div>

                {/* Floating Progress Indicator - Show during generation */}
                {loading && generationProgress > 0 && activeTab === "input" && (
                  <div className="fixed bottom-6 right-6 z-50 bg-[#1a1a1a] border border-white/10 rounded-lg p-4 shadow-2xl max-w-sm">
                    <ProgressBar progress={generationProgress} status={generationStatus} />
                  </div>
                )}

                {/* URL Input */}
                <div className="space-y-2">
                  <label className="text-xs tracking-widest text-gray-500 uppercase">Product URL (Optional)</label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/product"
                    className="w-full px-4 py-4 bg-white/5 border border-white/10 focus:border-white/30 focus:outline-none transition-colors text-base rounded-lg"
                  />
                </div>

                {/* Description Input - Wider */}
                <div className="space-y-2">
                  <label className="text-xs tracking-widest text-gray-500 uppercase">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your product, what it does, and what makes it special..."
                    rows={6}
                    className="w-full px-4 py-4 bg-white/5 border border-white/10 focus:border-white/30 focus:outline-none transition-colors resize-none text-base rounded-lg"
                  />
                </div>

                {/* Style & Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs tracking-widest text-gray-500 uppercase">Style</label>
                    <select
                      value={style}
                      onChange={(e) => setStyle(e.target.value as any)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-white/30 focus:outline-none rounded-lg"
                    >
                      <option value="professional">Professional (Aurora)</option>
                      <option value="playful">Playful (Blue Clean)</option>
                      <option value="minimal">Minimal (Floating Glass)</option>
                      <option value="bold">Bold (Blue Clean)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs tracking-widest text-gray-500 uppercase">Video Type</label>
                    <select
                      value={videoType}
                      onChange={(e) => setVideoType(e.target.value as any)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-white/30 focus:outline-none rounded-lg"
                    >
                      <option value="creative">Creative</option>
                      <option value="demo">Demo</option>
                      <option value="product-demo">Product Demo</option>
                      <option value="fast-paced">Fast-paced</option>
                      <option value="cinematic">Cinematic</option>
                    </select>
                  </div>
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs tracking-widest text-gray-500 uppercase">Duration</label>
                    <span className="text-sm text-gray-400">{duration}s</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="120"
                    step="1"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                </div>

                {/* Audio Selector */}
                <AudioSelector selectedAudio={selectedAudio} onSelect={setSelectedAudio} />

                {/* Recordings */}
                <div className="space-y-3">
                  <label className="text-xs tracking-widest text-gray-500 uppercase">Screen Recordings</label>
                  {recordings.length === 0 ? (
                    <button
                      onClick={() => setShowRecordingModal(true)}
                      className="w-full py-4 border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center gap-3 hover:border-white/20 transition-colors text-gray-500"
                    >
                      <Monitor className="w-5 h-5" />
                      <span>Add a screen recording</span>
                    </button>
                  ) : (
                    <div className="space-y-3">
                      {recordings.map((recording) => {
                        const isProcessing =
                          recording.processingStatus === "pending" || recording.processingStatus === "processing";
                        const progress = recordingProgress[recording.id] || 0;
                        const hasProcessedVideo = !!recording.processedVideoUrl;
                        const isFailed = recording.processingStatus === "failed";

                        return (
                          <div key={recording.id} className="bg-white/5 border border-white/10 p-4 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${
                                  hasProcessedVideo ? 'bg-green-400' :
                                  isFailed ? 'bg-red-400' :
                                  isProcessing ? 'bg-yellow-400 animate-pulse' :
                                  'bg-gray-400'
                                }`} />
                                <span className="text-sm">{recording.featureName}</span>
                                <span className="text-xs text-gray-500">{formatTime(Math.round(recording.duration))}</span>
                                {hasProcessedVideo ? (
                                  <span className="text-xs text-green-400">Ready</span>
                                ) : isFailed ? (
                                  <span className="text-xs text-red-400">Failed</span>
                                ) : isProcessing ? (
                                  <span className="text-xs text-yellow-400 flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Processing {progress > 0 ? `${progress}%` : ''}
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditingRecording(recording);
                                    setEditTrimStart(recording.trimStart);
                                    setEditTrimEnd(recording.trimEnd);
                                    setEditMockupFrame(recording.mockupFrame || "minimal");
                                    setEditCursorStyle(recording.cursorStyle || "hand");
                                    setRecordingFeatureName(recording.featureName);
                                    setRecordingDescription(recording.description);
                                    setShowRecordingModal(true);
                                  }}
                                  className="text-gray-500 hover:text-white"
                                  title="Edit recording"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Discard recording "${recording.featureName}"?`)) return;
                                    try {
                                      await fetch(`/api/recordings/${recording.id}`, { method: "DELETE" });
                                    } catch (err) {
                                      console.error("Failed to delete recording:", err);
                                    }
                                    setRecordings(prev => prev.filter(r => r.id !== recording.id));
                                  }}
                                  className="text-gray-500 hover:text-red-400"
                                  title="Discard recording"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <button
                        onClick={() => setShowRecordingModal(true)}
                        className="w-full py-2 text-sm text-gray-500 hover:text-white transition-colors"
                      >
                        + Add Another
                      </button>
                    </div>
                  )}
                </div>

                {/* Progress Bar - Show during generation */}
                {loading && generationProgress > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <ProgressBar progress={generationProgress} status={generationStatus} />
                  </div>
                )}



                {/* Generate Button */}
                <Button
                  onClick={handleGenerate}
                  disabled={loading || !description.trim()}
                  className="w-full rounded-lg py-6 text-lg"
                  size="lg"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="animate-spin h-5 w-5" />
                      Generating Script...
                    </span>
                  ) : (
                    "Generate Script"
                  )}
                </Button>
              </div>

              {/* Right Column - Tips & Preview */}
              <div className="space-y-8">
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-medium mb-4">Tips for Better Results</h3>
                  <ul className="space-y-3 text-sm text-gray-400">
                    <li className="flex items-start gap-3">
                      <span className="text-green-400">✓</span>
                      <span>Be specific about your product's key features</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-400">✓</span>
                      <span>Mention your target audience</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-400">✓</span>
                      <span>Include any specific phrases or taglines</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-400">✓</span>
                      <span>Add screen recordings to show features in action</span>
                    </li>
                  </ul>
                </div>

                {/* Live Preview Placeholder */}
                <div className="aspect-video bg-black rounded-xl overflow-hidden border border-white/10">
                  <Player
                    component={PlaceholderComposition}
                    durationInFrames={150}
                    fps={30}
                    compositionWidth={1920}
                    compositionHeight={1080}
                    style={{ width: "100%", height: "100%" }}
                    controls
                    loop
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCRIPT TAB - Visual Scene Editor */}
        {activeTab === "script" && (
          <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Loading State - Script is being generated */}
            {loading && !editableScript && (
              <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-full max-w-lg space-y-8">
                  {/* Animated Icon */}
                  <div className="flex justify-center">
                    <div className="relative">
                      <Loader2 className="w-16 h-16 animate-spin text-purple-500" />
                      <div className="absolute inset-0 w-16 h-16 animate-ping rounded-full bg-purple-500/20" />
                    </div>
                  </div>

                  {/* Status Text */}
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-light">Generating Your Script</h2>
                    <p className="text-gray-500">{generationStatus || "Initializing AI..."}</p>
                  </div>

                  {/* Progress Bar */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-6">
                    <ProgressBar progress={generationProgress} status={generationStatus} />
                  </div>

                  {/* Loading Steps */}
                  <div className="space-y-3 text-sm">
                    {[
                      { label: "Analyzing your product", threshold: 20 },
                      { label: "Extracting key features", threshold: 40 },
                      { label: "Crafting video scenes", threshold: 60 },
                      { label: "Optimizing script flow", threshold: 80 },
                      { label: "Finalizing", threshold: 100 },
                    ].map((step, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 transition-opacity duration-300 ${
                          generationProgress >= step.threshold ? "opacity-100" : "opacity-30"
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${
                          generationProgress >= step.threshold ? "bg-green-400" : "bg-gray-600"
                        }`} />
                        <span className={generationProgress >= step.threshold ? "text-gray-300" : "text-gray-600"}>
                          {step.label}
                        </span>
                        {generationProgress >= step.threshold && generationProgress < step.threshold + 20 && (
                          <Loader2 className="w-3 h-3 animate-spin ml-auto text-purple-400" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Script Ready State */}
            {editableScript && (
              <>
                {/* Script Header */}
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-light mb-1">Video Script</h2>
                    <p className="text-gray-500">{editableScript.scenes.length} scenes • {Math.round(editableScript.totalDuration / 30)}s</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleContinueGeneration}
                      disabled={loading}
                      className="rounded-lg"
                      size="lg"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="animate-spin h-5 w-5" />
                          Generating Video...
                        </span>
                      ) : (
                        "Approve & Generate Video"
                      )}
                    </Button>
                    <Button
                      onClick={() => setShowFullPreview(!showFullPreview)}
                      variant="outline"
                      className="rounded-lg"
                    >
                      {showFullPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      <span className="ml-2">{showFullPreview ? "Hide" : "Show"} Full Preview</span>
                    </Button>
                  </div>
                </div>

                {/* Progress Bar - Show during generation */}
                {loading && generationProgress > 0 && (
                  <div className="mb-6 bg-white/5 border border-white/10 rounded-lg p-4">
                    <ProgressBar progress={generationProgress} status={generationStatus} />
                  </div>
                )}

                {/* Full Video Preview - Only shown when requested */}
                {showFullPreview && (
                  <div className="mb-8 aspect-video bg-black rounded-xl overflow-hidden border border-white/10">
                    <Player
                      component={CompositionComponent}
                      durationInFrames={totalDuration}
                      fps={30}
                      compositionWidth={1920}
                      compositionHeight={1080}
                      style={{ width: "100%", height: "100%" }}
                      controls
                      loop
                    />
                  </div>
                )}

                {/* Screenshot & Logo Selection */}
                <div className="mb-8 bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-purple-400" />
                      Screenshots
                    </h3>
                  </div>

                  <ScreenshotSelector
                    screenshots={scrapedScreenshots}
                    logos={extractedLogos}
                    onSelectionChange={setSelectedScreenshots}
                    onUpload={(uploaded) => {
                      setScrapedScreenshots((prev) => [...prev, ...uploaded]);
                      setSelectedScreenshots((prev) => [...prev, ...uploaded]);
                      setProductData((prev: any) => ({
                        ...prev,
                        screenshots: [...(prev?.screenshots || []), ...uploaded],
                      }));
                    }}
                    isAnalyzing={isAnalyzingScreenshots}
                    projectId={projectId}
                  />
                </div>

                {/* Scenes Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {editableScript.scenes.map((scene, idx) => (
                    <div
                      key={scene.id}
                      className={`bg-white/5 border rounded-xl overflow-hidden transition-all ${
                        selectedSceneId === scene.id ? "border-purple-500 ring-2 ring-purple-500/20" : "border-white/10"
                      }`}
                      onClick={() => setSelectedSceneId(scene.id)}
                    >
                      {/* Scene Preview */}
                      <div className="aspect-video bg-black relative">
                        <Player
                          component={() => <ScenePreview scene={scene} />}
                          durationInFrames={scene.endFrame - scene.startFrame}
                          fps={30}
                          compositionWidth={1920}
                          compositionHeight={1080}
                          style={{ width: "100%", height: "100%" }}
                          controls
                          loop
                        />
                        <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-xs">
                          Scene {idx + 1}
                        </div>
                        <div className="absolute top-2 right-2 bg-white/10 px-2 py-1 rounded text-xs">
                          {Math.round((scene.endFrame - scene.startFrame) / 30)}s
                        </div>
                      </div>

                      {/* Scene Editor */}
                      <div className="p-4 space-y-4">
                        {/* Scene Type */}
                        <select
                          value={scene.type}
                          onChange={(e) => {
                            setIsSceneUpdating(scene.id);
                            handleUpdateScene(scene.id, { type: e.target.value as any });
                            setTimeout(() => setIsSceneUpdating(null), 500);
                          }}
                          disabled={isSceneUpdating === scene.id}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm focus:border-white/30 focus:outline-none disabled:opacity-50"
                        >
                          <option value="intro">Intro</option>
                          <option value="feature">Feature</option>
                          <option value="tagline">Tagline</option>
                          <option value="value-prop">Value Prop</option>
                          <option value="screenshot">Screenshot</option>
                          <option value="testimonial">Testimonial</option>
                          <option value="recording">Recording</option>
                          <option value="cta">CTA</option>
                        </select>

                        {/* Headline */}
                        <input
                          type="text"
                          value={scene.content.headline || ""}
                          onChange={(e) => {
                            setIsSceneUpdating(scene.id);
                            handleUpdateScene(scene.id, { content: { ...scene.content, headline: e.target.value } });
                            setTimeout(() => setIsSceneUpdating(null), 500);
                          }}
                          placeholder="Headline"
                          disabled={isSceneUpdating === scene.id}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm focus:border-white/30 focus:outline-none disabled:opacity-50"
                        />

                        {/* Subtext */}
                        <input
                          type="text"
                          value={scene.content.subtext || ""}
                          onChange={(e) => {
                            setIsSceneUpdating(scene.id);
                            handleUpdateScene(scene.id, { content: { ...scene.content, subtext: e.target.value } });
                            setTimeout(() => setIsSceneUpdating(null), 500);
                          }}
                          placeholder="Subtext (optional)"
                          disabled={isSceneUpdating === scene.id}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm focus:border-white/30 focus:outline-none text-gray-400 disabled:opacity-50"
                        />

                        {/* Recording/Screenshot Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowRecordingModal(true)}
                            disabled={isSceneUpdating === scene.id}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-white/5 border border-white/10 rounded text-xs hover:bg-white/10 transition-colors disabled:opacity-50"
                          >
                            {isSceneUpdating === scene.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Video className="w-3 h-3" />
                            )}
                            {isSceneUpdating === scene.id ? "Updating..." : "Add Recording"}
                          </button>
                          <label className="flex-1 flex items-center justify-center gap-2 py-2 bg-white/5 border border-white/10 rounded text-xs hover:bg-white/10 transition-colors cursor-pointer">
                            <ImageIcon className="w-3 h-3" />
                            Add Screenshot
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const url = URL.createObjectURL(file);
                                  handleAddScreenshotToScene(scene.id, url);
                                }
                              }}
                            />
                          </label>
                        </div>

                        {/* Scene Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/10">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => idx > 0 && handleReorderScene(idx, idx - 1)}
                              disabled={idx === 0 || isSceneUpdating !== null}
                              className="p-1 text-gray-500 hover:text-white disabled:opacity-20"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => idx < editableScript.scenes.length - 1 && handleReorderScene(idx, idx + 1)}
                              disabled={idx === editableScript.scenes.length - 1 || isSceneUpdating !== null}
                              className="p-1 text-gray-500 hover:text-white disabled:opacity-20"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                          <button
                            onClick={() => {
                              setIsSceneUpdating(scene.id);
                              handleRemoveScene(scene.id);
                              setTimeout(() => setIsSceneUpdating(null), 500);
                            }}
                            disabled={isSceneUpdating !== null}
                            className="p-1 text-gray-500 hover:text-red-400 disabled:opacity-20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add Scene Button */}
                  <button
                    onClick={handleAddScene}
                    disabled={isSceneUpdating !== null}
                    className="aspect-[4/3] border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-white/20 transition-colors text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-8 h-8" />
                    <span className="text-sm">{isSceneUpdating !== null ? "Updating..." : "Add Scene"}</span>
                  </button>
                </div>

                {/* Chat-based editing */}
                <div className="mt-8 bg-white/5 border border-white/10 rounded-xl p-4">
                  {scriptChatHistory.length > 0 && (
                    <div className="max-h-32 overflow-y-auto mb-4 space-y-2">
                      {scriptChatHistory.map((msg, i) => (
                        <div key={i} className={`text-sm ${msg.role === "user" ? "text-gray-300" : "text-purple-400"}`}>
                          <span className="text-gray-600 font-mono text-xs">{msg.role === "user" ? "you" : "ai"}:</span>{" "}
                          {msg.text}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={scriptChatInput}
                      onChange={(e) => setScriptChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleScriptChat(); } }}
                      placeholder="Edit by chat... e.g. 'make the intro longer'"
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-white/30 focus:outline-none"
                      disabled={scriptChatLoading}
                    />
                    <button
                      onClick={handleScriptChat}
                      disabled={scriptChatLoading || !scriptChatInput.trim()}
                      className="px-4 py-3 bg-white/10 rounded-lg text-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                    >
                      {scriptChatLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* PREVIEW TAB - Final Video */}
        {activeTab === "preview" && (
          <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Progress Bar - Show during rendering */}
            {(rendering || (loading && generationProgress > 0)) && (
              <div className="mb-8 bg-white/5 border border-white/10 rounded-lg p-6">
                <ProgressBar progress={rendering ? renderProgress : generationProgress} status={generationStatus || "Rendering video..."} />
              </div>
            )}

            {renderedVideoUrl ? (
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Video Preview + Edit Chat - Takes up 2 columns */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="aspect-video bg-black rounded-xl overflow-hidden border border-white/10">
                    <video
                      ref={editVideoRef}
                      src={`${renderedVideoUrl}?v=${renderVersion}`}
                      controls
                      className="w-full h-full"
                      autoPlay={false}
                      key={`${renderedVideoUrl}-${renderVersion}`}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap justify-center gap-4">
                    <Button asChild size="lg" className="rounded-lg">
                      <a href={`${renderedVideoUrl}?v=${renderVersion}`} download className="inline-flex items-center gap-2">
                        <Download className="w-5 h-5" />
                        Download Video
                      </a>
                    </Button>

                    <Button variant="outline" size="lg" className="rounded-lg" onClick={() => router.push('/projects')}>
                      Back to Projects
                    </Button>
                  </div>

                  {/* Edit Progress */}
                  {editProgress > 0 && editProgress < 100 && (
                    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                      <ProgressBar progress={editProgress} status={editStatus} />
                    </div>
                  )}

                  {/* Edit Chat - Always visible */}
                  {remotionCode && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                        <Edit2 className="w-5 h-5" />
                        Edit Video via Chat
                      </h3>
                      <p className="text-sm text-gray-400 mb-4">
                        Describe changes you want to make to the video
                      </p>

                      {/* Chat History */}
                      {videoEditHistory.length > 0 && (
                        <div className="max-h-64 overflow-y-auto mb-4 space-y-3">
                          {videoEditHistory.map((msg, i) => (
                            <div key={i} className={`text-sm ${msg.role === "user" ? "text-gray-300" : "text-purple-400"}`}>
                              <span className="text-gray-600 font-mono text-xs">{msg.role === "user" ? "you" : "ai"}:</span>{" "}
                              {msg.text}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Edit Input */}
                      <div className="space-y-3">
                        <textarea
                          value={videoEditInput}
                          onChange={(e) => setVideoEditInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleVideoEdit();
                            }
                          }}
                          placeholder="e.g., 'make the intro faster', 'change the colors to blue', 'add more zoom effects'"
                          rows={3}
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm resize-none"
                          disabled={videoEditLoading}
                        />
                        <Button
                          onClick={handleVideoEdit}
                          disabled={videoEditLoading || !videoEditInput.trim()}
                          className="w-full"
                        >
                          {videoEditLoading ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Editing...
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <Send className="w-4 h-4" />
                              Apply Edit
                            </span>
                          )}
                        </Button>
                      </div>

                      {/* Quick Edit Suggestions */}
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <h4 className="text-sm font-medium mb-3 text-gray-400">Quick Edits</h4>
                        <div className="flex flex-wrap gap-2">
                          {[
                            "Make it faster",
                            "Change colors to blue",
                            "Add more zoom",
                            "Make text bigger",
                            "Add background effects",
                            "Slow down intro"
                          ].map((suggestion) => (
                            <button
                              key={suggestion}
                              onClick={() => setVideoEditInput(suggestion)}
                              className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-colors"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Version History Sidebar - Always visible */}
                <div className="space-y-4">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Version History
                      </h4>
                      <span className="text-xs text-gray-500">{versions.length} version{versions.length !== 1 ? 's' : ''}</span>
                    </div>

                    {versions.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No versions yet. Edit the video to create versions.</p>
                    ) : (
                      <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                        {[...versions].reverse().map((version) => (
                          <div
                            key={version.id}
                            className={`p-3 rounded-lg border transition-all ${
                              version.id === currentVersionId
                                ? 'bg-purple-500/20 border-purple-500/50'
                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">
                                Version {version.versionNumber}
                                {version.id === currentVersionId && (
                                  <span className="ml-2 text-xs text-purple-400">(current)</span>
                                )}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(version.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 truncate mb-2">{version.editMessage}</p>

                            {/* Inline video player */}
                            {version.videoUrl && (
                              <div className="mb-2 rounded overflow-hidden border border-white/10">
                                <video
                                  src={version.videoUrl}
                                  controls
                                  preload="metadata"
                                  className="w-full aspect-video bg-black"
                                />
                              </div>
                            )}

                            {version.videoUrl && (
                              <div className="flex gap-2">
                                {version.id !== currentVersionId && (
                                  <button
                                    onClick={() => switchToVersion(version)}
                                    className="text-xs px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded transition-colors"
                                  >
                                    Use this version
                                  </button>
                                )}
                                <a
                                  href={version.videoUrl}
                                  download
                                  className="text-xs px-2 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors"
                                >
                                  Download
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-24">
                <div className="text-6xl mb-4">🎬</div>
                <h2 className="text-2xl font-light mb-2">No Video Generated Yet</h2>
                <p className="text-gray-500 mb-6">Approve your script to generate the final video</p>
                <Button onClick={() => setActiveTab("script")} size="lg" className="rounded-lg">
                  Go to Script
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Recording Modal */}
      {showRecordingModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => { if (!isRecording && !uploading) { setShowRecordingModal(false); setEditingRecording(null); } }} />
          <div className="relative max-w-2xl w-full bg-[#111] border border-white/10 rounded-xl p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-light">
                {editingRecording ? "Edit Recording" : isRecording ? "Recording..." : "Add Recording"}
              </h2>
              <button onClick={() => { if (!isRecording && !uploading) { setShowRecordingModal(false); setEditingRecording(null); } }} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {editingRecording ? (
              <div className="space-y-5">
                <video ref={editVideoRef} src={editingRecording.videoUrl} controls className="w-full max-h-[300px] bg-black rounded-lg" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Start (s)</label>
                    <input
                      type="number"
                      value={editTrimStart}
                      onChange={(e) => setEditTrimStart(Math.max(0, parseFloat(e.target.value) || 0))}
                      min={0} max={editTrimEnd} step={0.1}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded focus:border-white/30 focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">End (s)</label>
                    <input
                      type="number"
                      value={editTrimEnd}
                      onChange={(e) => setEditTrimEnd(Math.min(editingRecording.duration, parseFloat(e.target.value) || 0))}
                      min={editTrimStart} max={editingRecording.duration} step={0.1}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded focus:border-white/30 focus:outline-none text-sm"
                    />
                  </div>
                </div>

                <Button onClick={handleSaveRecordingEdit} className="w-full rounded-lg" size="lg">
                  Save Recording
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-xs tracking-widest text-gray-500 uppercase mb-2">Feature Name</label>
                    <input
                      type="text"
                      value={recordingFeatureName}
                      onChange={(e) => setRecordingFeatureName(e.target.value)}
                      placeholder="e.g., Smart Search"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:border-white/30 focus:outline-none text-sm"
                      disabled={isRecording}
                    />
                  </div>
                </div>

                {!isRecording && (
                  <>
                    <div className="flex gap-1 mb-4">
                      <button
                        onClick={() => setRecordingMode("record")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-lg transition-colors ${
                          recordingMode === "record" ? "bg-white/10 text-white border border-white/20" : "bg-white/5 text-gray-500 border border-white/5 hover:text-white"
                        }`}
                      >
                        <Monitor className="w-4 h-4" />
                        Record
                      </button>
                      <button
                        onClick={() => setRecordingMode("upload")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-lg transition-colors ${
                          recordingMode === "upload" ? "bg-white/10 text-white border border-white/20" : "bg-white/5 text-gray-500 border border-white/5 hover:text-white"
                        }`}
                      >
                        <Upload className="w-4 h-4" />
                        Upload
                      </button>
                    </div>

                  </>
                )}

                <div className="flex flex-col items-center gap-4">
                  {recordingMode === "record" ? (
                    !isRecording ? (
                      <>
                        <Button onClick={startRecording} disabled={!recordingFeatureName.trim()} size="lg" className="rounded-lg flex items-center gap-2">
                          <Monitor className="w-5 h-5" />
                          Start Recording
                        </Button>
                        <p className="text-xs text-gray-600">Select a window or tab to capture</p>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                          <span className="font-mono text-2xl text-red-400">{formatTime(recordingTime)}</span>
                        </div>
                        <Button variant="destructive" size="lg" onClick={stopRecording} className="rounded-lg">
                          Stop Recording
                        </Button>
                      </div>
                    )
                  ) : (
                    <div className="w-full space-y-4">
                      <label className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-white/10 hover:border-white/20 cursor-pointer transition-colors rounded-lg">
                        <Upload className="w-8 h-8 text-gray-500" />
                        <span className="text-sm text-gray-400">
                          {uploadFile ? uploadFile.name : "Drop video file or click to browse"}
                        </span>
                        <input type="file" accept="video/*" className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
                      </label>
                      {uploadFile && (
                        <Button onClick={handleUpload} disabled={uploading || !recordingFeatureName.trim()} className="w-full rounded-lg" size="lg">
                          {uploading ? <span className="flex items-center gap-2"><Loader2 className="animate-spin h-5 w-5" />Uploading...</span> : "Upload"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
