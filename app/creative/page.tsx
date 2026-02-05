"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Player } from "@remotion/player";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import type { VideoScript, VideoScene } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, Copy, Loader2, Menu, X, ArrowRight } from "lucide-react";

// Animation Components
const BlurInText: React.FC<{
  text: string;
  fontSize?: number;
  delay?: number;
  color?: string;
}> = ({ text, fontSize = 72, delay = 0, color = "#ffffff" }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const opacity = interpolate(f, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const blur = interpolate(f, [0, 25], [15, 0], { extrapolateRight: "clamp" });
  const y = interpolate(f, [0, 25], [30, 0], { extrapolateRight: "clamp" });

  return (
    <span
      style={{
        fontSize,
        fontWeight: "bold",
        fontFamily: "system-ui, sans-serif",
        color,
        opacity,
        filter: `blur(${blur}px)`,
        transform: `translateY(${y}px)`,
        display: "inline-block",
      }}
    >
      {text}
    </span>
  );
};

const StaggerWords: React.FC<{
  text: string;
  fontSize?: number;
  delay?: number;
  staggerDelay?: number;
  color?: string;
}> = ({ text, fontSize = 32, delay = 0, staggerDelay = 4, color = "#ffffff" }) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.3em",
        justifyContent: "center",
        fontSize,
        fontFamily: "system-ui, sans-serif",
        color,
      }}
    >
      {words.map((word, i) => {
        const f = Math.max(0, frame - delay - i * staggerDelay);
        const opacity = interpolate(f, [0, 15], [0, 1], { extrapolateRight: "clamp" });
        const y = interpolate(f, [0, 15], [20, 0], { extrapolateRight: "clamp" });
        return (
          <span key={i} style={{ opacity, transform: `translateY(${y}px)` }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};

const GradientBackground: React.FC<{ colors: string[] }> = ({ colors }) => {
  const frame = useCurrentFrame();
  const angle = interpolate(frame, [0, 300], [0, 360]);
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${angle}deg, ${colors.join(", ")})`,
      }}
    />
  );
};

const SceneRenderer: React.FC<{ scene: VideoScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneProgress = spring({ frame, fps, config: { damping: 200 } });
  const opacity = interpolate(sceneProgress, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ opacity }}>
      <GradientBackground colors={[scene.style.background, "#0a0a0a"]} />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
          textAlign: "center",
        }}
      >
        {scene.content.headline && (
          <BlurInText
            text={scene.content.headline}
            fontSize={72}
            color={scene.style.textColor}
          />
        )}
        {scene.content.subtext && (
          <div style={{ marginTop: 24 }}>
            <StaggerWords
              text={scene.content.subtext}
              fontSize={28}
              delay={15}
              color={scene.style.textColor}
            />
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const DynamicComposition: React.FC<{ script: VideoScript }> = ({ script }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {script.scenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={scene.endFrame - scene.startFrame}
        >
          <SceneRenderer scene={scene} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const PlaceholderComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 12 } });
  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ opacity, transform: `scale(${scale})`, textAlign: "center" }}>
        <div className="text-6xl mb-6">🎬</div>
        <h1 style={{ color: "#ffffff", fontSize: 42, fontWeight: "bold", margin: 0 }}>
          Your Video Awaits
        </h1>
        <p style={{ color: "#666", fontSize: 18, marginTop: 16 }}>
          Enter a description to begin production
        </p>
      </div>
    </AbsoluteFill>
  );
};

export default function CreativeStudioPage() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState<"professional" | "playful" | "minimal" | "bold">("professional");
  const [videoType, setVideoType] = useState<"demo" | "creative" | "fast-paced" | "cinematic">("creative");
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [script, setScript] = useState<VideoScript | null>(null);
  const [reactCode, setReactCode] = useState<string | null>(null);
  const [remotionCode, setRemotionCode] = useState<string | null>(null);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"preview" | "react" | "remotion" | "rendered" | "custom">("preview");
  const [customCode, setCustomCode] = useState<string>("");
  const [customDuration, setCustomDuration] = useState<number>(300);
  const [customRendering, setCustomRendering] = useState(false);
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const logsEndRef = React.useRef<HTMLDivElement>(null);

  const addLog = (message: string, type: "info" | "success" | "error" = "info") => {
    const prefix = type === "success" ? "✓" : type === "error" ? "✗" : "→";
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${prefix} ${message}`]);
  };

  React.useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError("Please enter a description");
      return;
    }

    setLoading(true);
    setError(null);
    setLogs([]);
    setScript(null);
    setReactCode(null);
    setRemotionCode(null);
    setRenderedVideoUrl(null);

    addLog(`Starting production workflow for "${description}"...`);
    addLog(`Style: ${style}, Type: ${videoType}`);

    try {
      const response = await fetch("/api/creative/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, style, videoType }),
      });

      if (!response.ok) throw new Error("API request failed");

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
                break;
              case "productData":
                addLog("Product data extracted", "success");
                break;
              case "videoScript":
                setScript(event.data);
                addLog(`Video script created with ${event.data.scenes?.length || 0} scenes`, "success");
                break;
              case "reactPageCode":
                setReactCode(event.data);
                addLog("React composition generated", "success");
                break;
              case "remotionCode":
                setRemotionCode(event.data);
                addLog("Remotion code translated", "success");
                break;
              case "error":
                setError(event.data.errors?.join(", ") || "Unknown error");
                addLog(event.data.errors?.[0] || "Error occurred", "error");
                break;
              case "complete":
                addLog("Production complete! Click 'Render Video' to export.", "success");
                break;
            }
          } catch (e) {
            console.warn("Failed to parse event:", line);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      addLog(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRender = async () => {
    if (!remotionCode) {
      setError("No Remotion code available. Generate first!");
      return;
    }

    setRendering(true);
    setRenderProgress(0);
    setError(null);
    addLog("Starting server-side render...");

    const progressInterval = setInterval(() => {
      setRenderProgress((prev) => Math.min(prev + 5, 90));
    }, 1000);

    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remotionCode,
          durationInFrames: script?.totalDuration || 300,
          format: "mp4",
        }),
      });

      clearInterval(progressInterval);
      const result = await response.json();

      if (result.success) {
        setRenderProgress(100);
        setRenderedVideoUrl(result.videoUrl);
        addLog(`Video rendered in ${Math.round(result.renderTime / 1000)}s`, "success");
        addLog(`Download: ${result.videoUrl}`, "success");
        setActiveTab("rendered");
      } else {
        throw new Error(result.error || "Render failed");
      }
    } catch (err) {
      clearInterval(progressInterval);
      const message = err instanceof Error ? err.message : "Render failed";
      setError(message);
      addLog(`Render error: ${message}`, "error");
    } finally {
      setRendering(false);
    }
  };

  const handleCustomRender = async () => {
    if (!customCode.trim()) {
      setError("Please paste Remotion code first");
      return;
    }

    setCustomRendering(true);
    setRenderProgress(0);
    setError(null);
    addLog("Starting custom code render...");

    const progressInterval = setInterval(() => {
      setRenderProgress((prev) => Math.min(prev + 5, 90));
    }, 1000);

    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remotionCode: customCode,
          durationInFrames: customDuration,
          format: "mp4",
        }),
      });

      clearInterval(progressInterval);
      const result = await response.json();

      if (result.success) {
        setRenderProgress(100);
        setCustomVideoUrl(result.videoUrl);
        addLog(`Custom video rendered in ${Math.round(result.renderTime / 1000)}s`, "success");
        addLog(`Download: ${result.videoUrl}`, "success");
      } else {
        throw new Error(result.error || "Render failed");
      }
    } catch (err) {
      clearInterval(progressInterval);
      const message = err instanceof Error ? err.message : "Render failed";
      setError(message);
      addLog(`Custom render error: ${message}`, "error");
    } finally {
      setCustomRendering(false);
    }
  };

  const CompositionComponent = script ? () => <DynamicComposition script={script} /> : PlaceholderComposition;
  const totalDuration = script?.totalDuration || 300;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-white selection:text-black">
      {/* Film Grain Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 px-6 py-6 flex items-center justify-between">
        <Link href="/" className="text-xl font-light tracking-[0.2em] uppercase">
          Remawt
        </Link>
        
        <div className="hidden md:flex items-center gap-8 text-sm tracking-wider">
          <Link href="/" className="hover:text-gray-400 transition-colors uppercase">Home</Link>
          <Link href="/pricing" className="hover:text-gray-400 transition-colors uppercase">Pricing</Link>
          <span className="text-gray-400 uppercase">Studio</span>
        </div>

        <button 
          className="md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="fixed inset-0 bg-black z-30 flex flex-col items-center justify-center gap-8 md:hidden">
          <Link href="/" className="text-2xl tracking-wider uppercase" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/pricing" className="text-2xl tracking-wider uppercase" onClick={() => setMenuOpen(false)}>Pricing</Link>
          <span className="text-2xl tracking-wider uppercase text-gray-400">Studio</span>
        </div>
      )}

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6 md:px-12 border-b border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8">
            <div>
              <span className="text-xs tracking-[0.3em] text-gray-600 uppercase block mb-4">Studio</span>
              <h1 className="text-[10vw] md:text-[6vw] font-light leading-[0.9]">
                Video
              </h1>
              <h1 className="text-[10vw] md:text-[6vw] font-light leading-[0.9]">
                Studio
              </h1>
            </div>
            <div className="text-sm tracking-widest text-gray-600 uppercase mt-8 md:mt-0 text-right">
              <span className="block">AI Production</span>
              <span className="block">Pipeline</span>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="grid lg:grid-cols-3 gap-12">
          {/* Controls Panel */}
          <div className="space-y-8">
            <Card className="bg-transparent border border-white/10 rounded-none">
              <CardHeader className="border-b border-white/10">
                <CardTitle className="flex items-center gap-3 text-lg font-light tracking-wide">
                  <Badge variant="outline" className="rounded-none">01</Badge>
                  Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div>
                  <label className="block text-xs tracking-widest text-gray-500 uppercase mb-3">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your product or video concept..."
                    rows={4}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-white/30 focus:outline-none transition-colors resize-none text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs tracking-widest text-gray-500 uppercase mb-3">Style</label>
                    <select
                      value={style}
                      onChange={(e) => setStyle(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 focus:border-white/30 focus:outline-none text-sm"
                    >
                      <option value="professional">Professional</option>
                      <option value="playful">Playful</option>
                      <option value="minimal">Minimal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs tracking-widest text-gray-500 uppercase mb-3">Type</label>
                    <select
                      value={videoType}
                      onChange={(e) => setVideoType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 focus:border-white/30 focus:outline-none text-sm"
                    >
                      <option value="creative">Creative</option>
                      <option value="demo">Demo</option>
                      <option value="fast-paced">Fast-paced</option>
                      <option value="cinematic">Cinematic</option>
                    </select>
                  </div>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={loading || rendering}
                  className="w-full rounded-none"
                  size="lg"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="animate-spin h-5 w-5" />
                      Producing...
                    </span>
                  ) : (
                    "Generate Video"
                  )}
                </Button>

                {remotionCode && (
                  <Button
                    onClick={handleRender}
                    disabled={loading || rendering}
                    variant="outline"
                    className="w-full rounded-none"
                    size="lg"
                  >
                    {rendering ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="animate-spin h-5 w-5" />
                        Rendering... {renderProgress}%
                      </span>
                    ) : (
                      "Render Video"
                    )}
                  </Button>
                )}

                {rendering && (
                  <div className="w-full bg-white/10 h-1 overflow-hidden">
                    <div className="bg-white h-full transition-all duration-300" style={{ width: `${renderProgress}%` }} />
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    <strong>Error:</strong> {error}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-transparent border border-white/10 rounded-none">
              <CardHeader className="border-b border-white/10">
                <CardTitle className="flex items-center gap-3 text-sm font-light tracking-wide">
                  <Badge variant="outline" className="rounded-none">02</Badge>
                  Production Log
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-48 overflow-y-auto font-mono text-xs space-y-1 bg-white/5 p-4 border border-white/10">
                  {logs.length === 0 ? (
                    <p className="text-gray-600 italic">Awaiting production...</p>
                  ) : (
                    logs.map((log, i) => (
                      <p key={i} className={log.includes("✓") ? "text-green-400" : log.includes("✗") ? "text-red-400" : "text-gray-400"}>
                        {log}
                      </p>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </CardContent>
            </Card>

            {script && (
              <Card className="bg-transparent border border-white/10 rounded-none">
                <CardHeader className="border-b border-white/10">
                  <CardTitle className="flex items-center gap-3 text-sm font-light tracking-wide">
                    <Badge variant="outline" className="rounded-none">03</Badge>
                    Script Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-3 gap-4 text-center mb-6">
                    <div className="bg-white/5 p-4 border border-white/10">
                      <div className="text-2xl font-light">{script.scenes.length}</div>
                      <div className="text-xs text-gray-600 uppercase tracking-wider mt-1">Scenes</div>
                    </div>
                    <div className="bg-white/5 p-4 border border-white/10">
                      <div className="text-2xl font-light">{Math.round(script.totalDuration / 30)}s</div>
                      <div className="text-xs text-gray-600 uppercase tracking-wider mt-1">Duration</div>
                    </div>
                    <div className="bg-white/5 p-4 border border-white/10">
                      <div className="text-2xl font-light">{script.music?.tempo || 120}</div>
                      <div className="text-xs text-gray-600 uppercase tracking-wider mt-1">BPM</div>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {script.scenes.map((scene, i) => (
                      <div key={scene.id} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 text-sm">
                        <span className="text-gray-600 font-mono w-6">{i + 1}</span>
                        <Badge variant="outline" className="rounded-none text-xs">{scene.type}</Badge>
                        <span className="text-gray-400 truncate flex-1">{scene.content.headline || "No headline"}</span>
                        <span className="text-gray-600 text-xs font-mono">{Math.round((scene.endFrame - scene.startFrame) / 30)}s</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Video Player & Code Tabs */}
          <div className="lg:col-span-2 space-y-8">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-white/10">
              {[
                { id: "preview", label: "Preview", disabled: false },
                { id: "react", label: "React Code", disabled: !reactCode },
                { id: "remotion", label: "Remotion Code", disabled: !remotionCode },
                { id: "rendered", label: "Rendered", disabled: !renderedVideoUrl },
                { id: "custom", label: "Custom", disabled: false },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  disabled={tab.disabled}
                  className={`px-6 py-3 text-sm tracking-wider uppercase transition-colors ${
                    activeTab === tab.id
                      ? "border-b-2 border-white text-white"
                      : "text-gray-500 hover:text-white"
                  } ${tab.disabled ? "opacity-30 cursor-not-allowed" : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <Card className="bg-transparent border border-white/10 rounded-none overflow-hidden">
              {activeTab === "preview" && (
                <div className="aspect-video bg-black">
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

              {activeTab === "react" && reactCode && (
                <div className="max-h-[600px] overflow-auto">
                  <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-500">React Code (Editable)</span>
                    <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(reactCode)} className="text-gray-400 hover:text-white">
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <textarea
                    value={reactCode}
                    onChange={(e) => setReactCode(e.target.value)}
                    className="w-full h-[550px] p-4 text-xs text-gray-300 font-mono bg-white/5 border-0 focus:outline-none resize-none"
                    spellCheck={false}
                  />
                </div>
              )}

              {activeTab === "remotion" && remotionCode && (
                <div className="max-h-[600px] overflow-auto">
                  <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-500">Remotion Code (Editable)</span>
                    <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(remotionCode)} className="text-gray-400 hover:text-white">
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <textarea
                    value={remotionCode}
                    onChange={(e) => setRemotionCode(e.target.value)}
                    className="w-full h-[550px] p-4 text-xs text-gray-300 font-mono bg-white/5 border-0 focus:outline-none resize-none"
                    spellCheck={false}
                  />
                </div>
              )}

              {activeTab === "rendered" && renderedVideoUrl && (
                <div className="aspect-video bg-black">
                  <video src={renderedVideoUrl} controls className="w-full h-full" autoPlay />
                </div>
              )}

              {activeTab === "rendered" && !renderedVideoUrl && (
                <div className="aspect-video bg-white/5 flex items-center justify-center border-2 border-dashed border-white/10">
                  <div className="text-center text-gray-600">
                    <div className="text-4xl mb-4">🎬</div>
                    <p>Click &quot;Render Video&quot; to generate the final output</p>
                  </div>
                </div>
              )}

              {activeTab === "custom" && (
                <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-xs tracking-widest text-gray-500 uppercase mb-3">Paste Remotion Code</label>
                    <textarea
                      value={customCode}
                      onChange={(e) => setCustomCode(e.target.value)}
                      placeholder={`// Paste your Remotion composition code here...`}
                      rows={12}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 focus:border-white/30 focus:outline-none font-mono text-xs resize-none"
                    />
                  </div>

                  <div className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-xs tracking-widest text-gray-500 uppercase mb-3">Duration (frames)</label>
                      <input
                        type="number"
                        value={customDuration}
                        onChange={(e) => setCustomDuration(parseInt(e.target.value) || 300)}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 focus:border-white/30 focus:outline-none"
                      />
                      <p className="text-xs text-gray-600 mt-1 font-mono">@ 30fps = {Math.round(customDuration / 30)}s</p>
                    </div>
                    <Button onClick={handleCustomRender} disabled={customRendering || !customCode.trim()} className="rounded-none">
                      {customRendering ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="animate-spin h-5 w-5" />
                          Rendering... {renderProgress}%
                        </span>
                      ) : (
                        "Render Custom"
                      )}
                    </Button>
                  </div>

                  {customRendering && (
                    <div className="w-full bg-white/10 h-1 overflow-hidden">
                      <div className="bg-white h-full transition-all duration-300" style={{ width: `${renderProgress}%` }} />
                    </div>
                  )}

                  {customVideoUrl && (
                    <div className="space-y-4">
                      <h4 className="text-sm tracking-widest uppercase text-gray-500">Rendered Output</h4>
                      <div className="aspect-video bg-black">
                        <video src={customVideoUrl} controls className="w-full h-full" autoPlay />
                      </div>
                      <Button asChild className="rounded-none">
                        <a href={customVideoUrl} download className="inline-flex items-center gap-2">
                          <Download className="w-4 h-4" />
                          Download MP4
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {renderedVideoUrl && (
              <div className="flex justify-center">
                <Button asChild size="lg" className="rounded-none">
                  <a href={renderedVideoUrl} download className="inline-flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    Download Video
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-24 py-12 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600 tracking-wider">
            REMAWT — AI-Powered Video Production
          </p>
          <div className="flex items-center gap-8 text-xs text-gray-600">
            <Link href="/" className="hover:text-white transition-colors uppercase tracking-wider">Home</Link>
            <Link href="/pricing" className="hover:text-white transition-colors uppercase tracking-wider">Pricing</Link>
            <span className="text-gray-400 uppercase tracking-wider">Studio</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
