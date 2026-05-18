import React from "react";
import { Composition, registerRoot } from "remotion";
import { DemoComposition } from "./compositions/DemoComposition";
import { TechLaunchContent, AppShowcaseContent } from "./templates/TechTemplates";
import ReelsFlyVideoContent from "./compositions/ReelsFlyVideo";
import TeambleDemoVideo from "./compositions/TeambleDemo";
import TechProductDemo from "./compositions/TechProductDemo";
import PremiumShowcase from "./compositions/PremiumShowcase";
import {
  JsonComposition,
  type VideoJsonInputProps,
} from "./compositions/JsonComposition";
import {
  JitterComposition,
  type JitterDocInputProps,
} from "./compositions/JitterComposition";
import GeneratedTest from "./compositions/GeneratedTest";

const SEARCH_ICON_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#404040" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  );

const SEARCH_BAR_JITTER: JitterDocInputProps = {
  name: "Search bar",
  fps: 30,
  conf: {
    artboards: [
      {
        id: "2:54",
        name: "Search",
        width: 1920,
        height: 1080,
        duration: 4000,
        fillColor: "#0b1020",
        background: true,
        operations: [
          {
            id: "vq04xmuZ",
            type: "growIn",
            targetId: "2:67",
            scale: 0.5,
            startTime: 0,
            endTime: 400,
            easing: "slowDown",
          },
          {
            id: "Wx2eq9xT",
            type: "growIn",
            targetId: "TPow4AfN",
            scale: 0.5,
            startTime: 100,
            endTime: 500,
            easing: "slowDown",
          },
          {
            id: "GwZcqotK",
            type: "resize",
            targetId: "2:67",
            anchor: "center",
            fromValue: { width: 80 },
            startTime: 400,
            endTime: 1100,
            easing: "natural",
          },
          {
            id: "cHMLsazs",
            type: "textIn",
            targetId: "2:61",
            split: "letters",
            order: "forward",
            offset: 50,
            travelDistance: 20,
            slideDirection: "up",
            nodeDuration: 500,
            nodeEasing: "slowDown",
            effect: "appear",
            startTime: 900,
          },
          {
            id: "4L1TwDaW",
            type: "shrinkOut",
            targetId: "2:67",
            scale: 0.8,
            startTime: 3200,
            endTime: 3500,
            easing: "accelerate",
          },
        ],
        layers: [
          {
            type: "layerGrp",
            id: "2:67",
            name: "Search bar",
            x: 620,
            y: 480,
            width: 680,
            height: 120,
            cornerRadius: 40,
            background: true,
            fillColor: "#ffffff",
            clipsContent: false,
            shadowEnabled: true,
            shadowOffsetX: 0,
            shadowOffsetY: 12,
            shadowBlur: 40,
            shadowColor: "#000000",
            shadowOpacity: 30,
            layers: [
              {
                type: "image",
                id: "TPow4AfN",
                url: SEARCH_ICON_SVG,
                mediaName: "Icon.svg",
                x: 40,
                y: 40,
                width: 40,
                height: 40,
              },
              {
                type: "text",
                id: "2:61",
                name: "Best motion design tool",
                x: 100,
                y: 40,
                width: 540,
                height: 40,
                text: "Best motion design tool",
                color: "#404040",
                font: { name: "Inter", weight: 500 },
                fontSize: 28,
                lineHeight: 140,
                letterSpacing: 0,
                textAlign: "left",
                verticalAlign: "center",
              },
            ],
          },
        ],
      },
    ],
  },
};

// Wrapper components to satisfy Remotion's type requirements
const TechLaunchWrapper: React.FC<Record<string, unknown>> = (props) => {
  return <TechLaunchContent {...(props as any)} />;
};

const AppShowcaseWrapper: React.FC<Record<string, unknown>> = (props) => {
  return <AppShowcaseContent {...(props as any)} />;
};

// Sample product data for preview
const sampleProductData = {
  name: "NexGen Platform",
  tagline: "The Future of Work",
  description: "Revolutionize your workflow with AI-powered automation and seamless collaboration tools.",
  features: [
    { title: "AI Automation", description: "Let artificial intelligence handle repetitive tasks", icon: "🤖" },
    { title: "Real-time Sync", description: "Changes appear instantly across all devices", icon: "⚡" },
    { title: "Advanced Security", description: "Enterprise-grade protection for your data", icon: "🔒" },
  ],
  images: [],
  colors: {
    primary: "#667eea",
    secondary: "#764ba2",
    accent: "#f093fb",
  },
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Most recent test-generate output (smoke test) */}
      <Composition
        id="GeneratedTest"
        component={GeneratedTest}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Original Demo */}
      <Composition
        id="Demo"
        component={DemoComposition}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* High-Energy Tech Launch Template */}
      <Composition
        id="TechLaunch"
        component={TechLaunchWrapper}
        durationInFrames={780}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          data: sampleProductData,
          bpm: 128,
        }}
      />

      {/* App Showcase Template */}
      <Composition
        id="AppShowcase"
        component={AppShowcaseWrapper}
        durationInFrames={780}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          data: sampleProductData,
          bpm: 110,
        }}
      />

      {/* ReelsFly High-Energy Demo */}
      <Composition
        id="ReelsFlyDemo"
        component={ReelsFlyVideoContent as React.FC}
        durationInFrames={1320}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          script: {
            totalDuration: 1320,
            scenes: [
              {
                id: "intro-hook",
                startFrame: 0,
                endFrame: 90,
                type: "intro",
                content: {
                  headline: "Forging Reality From Imagination",
                  subtext: "The advanced AI studio",
                  image: null,
                  icon: null,
                  stats: null,
                  features: null,
                },
                animation: { enter: "glitch", exit: "fade", staggerDelay: 2 },
                style: {
                  background: "linear-gradient(135deg, #000000 0%, #1e1b4b 100%)",
                  textColor: "#ffffff",
                  accentColor: "#6366F1",
                  fontSize: "large",
                  layout: "centered",
                  cardStyle: "none",
                },
              },
              {
                id: "problem-solution",
                startFrame: 90,
                endFrame: 240,
                type: "intro",
                content: {
                  headline: "Turn Text Into Motion",
                  subtext: "Seamless fusion of creativity & technology",
                  image: "https://reelsfly.com/fusionframe-logo.svg",
                  icon: null,
                  stats: null,
                  features: null,
                },
                animation: { enter: "stagger-words", exit: "blur-out", staggerDelay: 4 },
                style: {
                  background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
                  textColor: "#ffffff",
                  accentColor: "#6366F1",
                  fontSize: "medium",
                  layout: "split",
                  cardStyle: "spotlight",
                },
              },
              {
                id: "features-models",
                startFrame: 240,
                endFrame: 480,
                type: "feature",
                content: {
                  headline: "All Top Models. One Platform.",
                  subtext: null,
                  image: null,
                  icon: "🤖",
                  stats: null,
                  features: [
                    { icon: "🚀", title: "Runway Gen-3", description: "Cinematic realism" },
                    { icon: "✨", title: "Pika Labs", description: "Creative motion" },
                    { icon: "🌊", title: "SVD", description: "Stable diffusion" },
                  ],
                },
                animation: { enter: "stagger-chars", exit: "slide-up", staggerDelay: 8 },
                style: {
                  background: "linear-gradient(135deg, #000000 0%, #4338ca 100%)",
                  textColor: "#ffffff",
                  accentColor: "#6366F1",
                  fontSize: "medium",
                  layout: "bento",
                  cardStyle: "glass",
                },
              },
              {
                id: "features-workflow",
                startFrame: 480,
                endFrame: 720,
                type: "feature",
                content: {
                  headline: "Complete Pipeline",
                  subtext: "Script • Image • Motion • Voice",
                  image: "https://reelsfly.com/image.png",
                  icon: "⚡",
                  stats: null,
                  features: null,
                },
                animation: { enter: "slide-up", exit: "zoom-out", staggerDelay: 5 },
                style: {
                  background: "linear-gradient(135deg, #312e81 0%, #000000 100%)",
                  textColor: "#ffffff",
                  accentColor: "#6366F1",
                  fontSize: "medium",
                  layout: "split",
                  cardStyle: "glass",
                },
              },
              {
                id: "stats-speed",
                startFrame: 720,
                endFrame: 960,
                type: "stats",
                content: {
                  headline: "Lightning Fast Speed",
                  subtext: "Generate videos in minutes, not hours",
                  image: null,
                  icon: null,
                  stats: [{ value: 2.5, label: "Generation Time", suffix: "s" }],
                  features: null,
                },
                animation: { enter: "scale", exit: "fade", staggerDelay: 5 },
                style: {
                  background: "linear-gradient(135deg, #6366F1 0%, #4338ca 100%)",
                  textColor: "#ffffff",
                  accentColor: "#000000",
                  fontSize: "large",
                  layout: "centered",
                  cardStyle: "floating",
                },
              },
              {
                id: "features-control",
                startFrame: 960,
                endFrame: 1170,
                type: "feature",
                content: {
                  headline: "Uncompromised Control",
                  subtext: "Fine-tune resolution, frame rate, and vision.",
                  image: null,
                  icon: "🎛️",
                  stats: null,
                  features: [{ icon: "🔒", title: "Enterprise Ready", description: "Secure & Scalable" }],
                },
                animation: { enter: "kinetic", exit: "zoom-out", staggerDelay: 4 },
                style: {
                  background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
                  textColor: "#ffffff",
                  accentColor: "#6366F1",
                  fontSize: "medium",
                  layout: "centered",
                  cardStyle: "glass",
                },
              },
              {
                id: "cta-final",
                startFrame: 1170,
                endFrame: 1320,
                type: "cta",
                content: {
                  headline: "ReelsFly",
                  subtext: "Start Creating Cinematic Video",
                  image: "https://reelsfly.com/fusionframe-logo.svg",
                  icon: null,
                  stats: null,
                  features: null,
                },
                animation: { enter: "glitch", exit: "fade", staggerDelay: 5 },
                style: {
                  background: "linear-gradient(135deg, #4338ca 0%, #6366F1 50%, #000000 100%)",
                  textColor: "#ffffff",
                  accentColor: "#ffffff",
                  fontSize: "large",
                  layout: "centered",
                  cardStyle: "spotlight",
                },
              },
            ],
            music: { tempo: 120, mood: "energetic" },
          },
        }}
      />

      {/* Teamble-Style SaaS Demo Video */}
      <Composition
        id="TeambleDemo"
        component={TeambleDemoVideo}
        durationInFrames={1050}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* High-Energy Tech Product Demo */}
      <Composition
        id="TechProductDemo"
        component={TechProductDemo}
        durationInFrames={1020}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Premium Showcase - Device Mockups, 3D, Gradients */}
      <Composition
        id="PremiumShowcase"
        component={PremiumShowcase}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* JSON-driven composition — primary entry for the new pipeline.
          fps/width/height/durationInFrames derived per-render from inputProps. */}
      <Composition
        id="JsonComposition"
        component={JsonComposition}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          fps: 30,
          width: 1920,
          height: 1080,
          audio: null,
          scenes: [
            {
              id: "preview",
              durationInFrames: 90,
              layers: [
                { component: "GradientBg", props: { from: "#0f172a", to: "#7c3aed" } },
                { component: "Title", props: { text: "JsonComposition preview", delay: 5 } },
              ],
            },
          ],
        } satisfies VideoJsonInputProps}
        calculateMetadata={({ props }) => {
          const total = props.scenes.reduce(
            (s, x) => s + x.durationInFrames,
            0,
          );
          return {
            durationInFrames: Math.max(1, total),
            width: props.width || 1920,
            height: props.height || 1080,
            fps: props.fps || 30,
          };
        }}
      />

      {/* Jitter-style prototype — primitives + timeline operations */}
      <Composition
        id="JitterComposition"
        component={JitterComposition}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={SEARCH_BAR_JITTER}
        calculateMetadata={({ props }) => {
          const fps = props.fps ?? 30;
          const totalMs = props.conf.artboards.reduce(
            (s, a) => s + (a.duration ?? 0),
            0,
          );
          return {
            durationInFrames: Math.max(1, Math.round((totalMs * fps) / 1000)),
            width: props.conf.artboards[0]?.width || 1920,
            height: props.conf.artboards[0]?.height || 1080,
            fps,
          };
        }}
      />
    </>
  );
};
registerRoot(RemotionRoot);
