import React from "react";
import { Composition, registerRoot } from "remotion";
import { DemoComposition } from "./compositions/DemoComposition";
import { TechLaunchContent, AppShowcaseContent } from "./templates/TechTemplates";
import ReelsFlyVideoContent from "./compositions/ReelsFlyVideo";
import TeambleDemoVideo from "./compositions/TeambleDemo";
import TechProductDemo from "./compositions/TechProductDemo";
import PremiumShowcase from "./compositions/PremiumShowcase";

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
    </>
  );
};
registerRoot(RemotionRoot);
