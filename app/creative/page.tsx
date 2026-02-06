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
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";
import type { VideoScript, VideoScene } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AudioSelector, AudioFile } from "@/components/audio/AudioSelector";
import { Download, Copy, Loader2, Menu, X, ArrowRight } from "lucide-react";

// Load Google Fonts with specific weights
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

// STYLE GUIDELINES
// Typography Scale: Display (96px), Title (72px), Headline (48px), Body (28px), Caption (20px)
// Font Families: Poppins (headlines, bold), Inter (body, clean), Roboto (subtext)
// Spacing: Line height 1.2 for headlines, 1.5 for body
// Effects: Typing, blur-in, scale-in with spring physics

// Typography Components with Google Fonts

// Continuous Typing Effect - Types out text character by character
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
  
  // Characters to show based on frame
  const charsToShow = Math.floor(f / speed);
  const displayText = text.slice(0, Math.min(charsToShow, text.length));
  
  // Cursor blink
  const cursorVisible = cursor && (frame % fps < fps / 2);
  
  return (
    <span
      style={{
        fontSize,
        fontWeight: 700,
        fontFamily,
        color,
        lineHeight: 1.1,
        letterSpacing: "-0.02em",
        display: "inline-block",
      }}
    >
      {displayText}
      {cursorVisible && charsToShow < text.length && (
        <span style={{ opacity: 0.8 }}>|</span>
      )}
    </span>
  );
};

// Blur-in with Scale - For dramatic headlines
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
  
  // Spring physics for scale
  const scale = spring({
    frame: f,
    fps,
    config: { damping: 15, stiffness: 100 },
    from: 0.8,
    to: 1,
  });
  
  const opacity = interpolate(f, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const blur = interpolate(f, [0, 20], [20, 0], { extrapolateRight: "clamp" });
  const y = interpolate(f, [0, 20], [40, 0], { extrapolateRight: "clamp" });

  return (
    <span
      style={{
        fontSize,
        fontWeight: 800,
        fontFamily,
        color,
        opacity,
        filter: `blur(${blur}px)`,
        transform: `translateY(${y}px) scale(${scale})`,
        display: "inline-block",
        lineHeight: 1.1,
        letterSpacing: "-0.03em",
      }}
    >
      {text}
    </span>
  );
};

// Word-by-word reveal with stagger
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
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.4em",
        justifyContent: "center",
        fontSize,
        fontFamily,
        color,
        lineHeight: 1.3,
        fontWeight: 600,
      }}
    >
      {words.map((word, i) => {
        const f = Math.max(0, frame - delay - i * staggerDelay);
        const opacity = interpolate(f, [0, 15], [0, 1], { extrapolateRight: "clamp" });
        const y = interpolate(f, [0, 15], [30, 0], { extrapolateRight: "clamp" });
        const scale = spring({
          frame: f,
          fps,
          config: { damping: 12, stiffness: 150 },
          from: 0.5,
          to: 1,
        });
        
        return (
          <span 
            key={i} 
            style={{ 
              opacity, 
              transform: `translateY(${y}px) scale(${scale})`,
              display: "inline-block",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

// Clean body text with fade-in
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
    <p
      style={{
        fontSize,
        fontFamily,
        color,
        opacity,
        transform: `translateY(${y}px)`,
        lineHeight: 1.5,
        fontWeight: 400,
        letterSpacing: "0.01em",
        margin: 0,
      }}
    >
      {text}
    </p>
  );
};

// Subtext/Caption style
const CaptionText: React.FC<{
  text: string;
  fontSize?: number;
  delay?: number;
  color?: string;
}> = ({ 
  text, 
  fontSize = 20, 
  delay = 0, 
  color = "#888888"
}) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const opacity = interpolate(f, [0, 15], [0, 0.7], { extrapolateRight: "clamp" });

  return (
    <span
      style={{
        fontSize,
        fontFamily: robotoFont,
        color,
        opacity,
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase" as const,
      }}
    >
      {text}
    </span>
  );
};

const GradientBackground: React.FC<{ 
  colors: string[];
  animated?: boolean;
}> = ({ colors, animated = true }) => {
  const frame = useCurrentFrame();
  const angle = animated ? interpolate(frame, [0, 300], [0, 360]) : 45;
  
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${angle}deg, ${colors.join(", ")})`,
      }}
    />
  );
};

// Floating particles for visual interest
const FloatingParticles: React.FC<{ color?: string }> = ({ color = "#ffffff" }) => {
  const frame = useCurrentFrame();
  const particles = Array.from({ length: 20 }, (_, i) => ({
    x: (i * 137.5) % 100,
    y: (i * 73.3) % 100,
    size: 2 + (i % 4),
    speed: 0.1 + (i % 3) * 0.05,
  }));

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {particles.map((p, i) => {
        const y = (p.y + frame * p.speed) % 100;
        const opacity = 0.1 + (Math.sin(frame * 0.05 + i) + 1) * 0.1;
        
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${y}%`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: color,
              opacity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const SceneRenderer: React.FC<{ scene: VideoScene; sceneIndex?: number }> = ({ scene, sceneIndex = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneDuration = scene.endFrame - scene.startFrame;
  const isLastScene = frame > sceneDuration - 30; // Last second for exit
  
  // Fade in/out for smooth transitions
  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [sceneDuration - 20, sceneDuration], [1, 0], { 
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp" 
  });
  const opacity = Math.min(fadeIn, fadeOut);
  
  // Choose animation based on scene type
  const isIntro = scene.type === "intro";
  const isCTA = scene.type === "cta";
  
  return (
    <AbsoluteFill style={{ opacity }}>
      <GradientBackground colors={[scene.style.background, "#0a0a0a"]} />
      <FloatingParticles color={scene.style.textColor} />
      
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 100px",
          textAlign: "center",
          gap: "32px",
        }}
      >
        {/* Caption/Label for scene type */}
        {(isIntro || isCTA) && (
          <CaptionText 
            text={isIntro ? "Introducing" : "Get Started"}
            delay={5}
            color={scene.style.textColor}
          />
        )}
        
        {/* Main Headline with appropriate animation */}
        {scene.content.headline && (
          <div style={{ maxWidth: "900px" }}>
            {isIntro ? (
              // Intro: Dramatic blur-in with scale
              <BlurInText
                text={scene.content.headline}
                fontSize={88}
                delay={10}
                color={scene.style.textColor}
              />
            ) : (
              // Other scenes: Word-by-word reveal
              <WordReveal
                text={scene.content.headline}
                fontSize={64}
                delay={8}
                color={scene.style.textColor}
                staggerDelay={6}
              />
            )}
          </div>
        )}
        
        {/* Subtext with typing effect for extra impact */}
        {scene.content.subtext && (
          <div style={{ 
            marginTop: "16px", 
            maxWidth: "700px",
            opacity: isLastScene ? 0.5 : 1,
            transition: "opacity 0.3s"
          }}>
            <BodyText
              text={scene.content.subtext}
              fontSize={26}
              delay={isIntro ? 30 : 20}
              color={scene.style.textColor}
            />
          </div>
        )}
        
        {/* Features list if available */}
        {scene.content.features && scene.content.features.length > 0 && (
          <div style={{ 
            marginTop: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            alignItems: "center"
          }}>
            {scene.content.features.map((feature, idx) => (
              <div 
                key={idx}
                style={{
                  opacity: interpolate(frame, [20 + idx * 10, 35 + idx * 10], [0, 1], { 
                    extrapolateRight: "clamp" 
                  }),
                  transform: `translateY(${interpolate(frame, [20 + idx * 10, 35 + idx * 10], [20, 0], { 
                    extrapolateRight: "clamp" 
                  })}px)`,
                }}
              >
                <span style={{
                  fontFamily: poppinsFont,
                  fontSize: "24px",
                  fontWeight: 600,
                  color: scene.style.textColor,
                }}>
                  {feature.icon} {feature.title}
                </span>
              </div>
            ))}
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
  
  // Smooth fade and scale animation
  const scale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const opacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  
  // Subtle floating animation
  const floatY = Math.sin(frame * 0.05) * 5;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ 
        opacity, 
        transform: `scale(${scale}) translateY(${floatY}px)`, 
        textAlign: "center",
        maxWidth: "800px",
        padding: "40px"
      }}>
        {/* Animated icon */}
        <div style={{ 
          fontSize: "80px", 
          marginBottom: "40px",
          opacity: interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" })
        }}>
          🎬
        </div>
        
        {/* Title with typing effect */}
        <div style={{ marginBottom: "24px" }}>
          <TypingText
            text="Your Video Awaits"
            fontSize={72}
            delay={20}
            color="#ffffff"
            speed={3}
            cursor={true}
          />
        </div>
        
        {/* Subtitle */}
        <div style={{
          opacity: interpolate(frame, [50, 70], [0, 1], { extrapolateRight: "clamp" })
        }}>
          <BodyText
            text="Enter a description to begin production"
            fontSize={24}
            color="#666666"
          />
        </div>
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
  const [selectedAudio, setSelectedAudio] = useState<AudioFile | null>(null);
  const [duration, setDuration] = useState<number>(38); // Default 38s

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
        body: JSON.stringify({ 
          description, 
          style, 
          videoType,
          duration,
          audio: selectedAudio ? {
            url: selectedAudio.url,
            bpm: selectedAudio.bpm,
            duration: selectedAudio.duration,
          } : undefined,
        }),
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

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs tracking-widest text-gray-500 uppercase">Duration</label>
                    <span className="text-xs text-gray-400">{duration}s</span>
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
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>10s</span>
                    <span>65s</span>
                    <span>120s</span>
                  </div>
                </div>

                <AudioSelector
                  selectedAudio={selectedAudio}
                  onSelect={setSelectedAudio}
                />

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
