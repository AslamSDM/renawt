// Comprehensive Remotion Components Export
// This file serves as the main entry point for all Remotion components

// Animation Components
export {
  // Text Animations
  BlurInText,
  StaggerWords,
  StaggerChars,
  EncryptedText,
  GradientText,
  TypewriterPro,
  FlipText,
} from "./components/animations/TextAnimations";

// High-Energy Components
export {
  KineticText,
  GlitchText,
  AudioReactiveGradient,
  BeatFlashEnhanced,
  BeatPulseEnhanced,
  FastSlide,
} from "./components/animations/HighEnergy";

// Background Effects
export {
  GradientMeshBackground,
  ParticleField,
  NoiseGradientBackground,
  GridPatternBackground,
  BeamBackground,
  AuroraBackground,
  Vignette,
} from "./components/animations/Backgrounds";

// Card Components
export {
  GlassmorphicCard,
  SpotlightCard,
  TiltCard,
  BentoGrid,
  FloatingCard,
  FeatureCard,
  StatCard,
} from "./components/animations/Cards";

// Scroll Transitions
export {
  VerticalScrollComposition,
  HorizontalScrollComposition,
  PageScrollTransition,
  ZoomThroughTransition,
  ParallaxContainer,
  CrossfadeTransition,
  MorphTransition,
  StickyScrollSection,
} from "./components/animations/ScrollTransitions";

// Device Mockups
export {
  IPhoneMockup,
  MacBookMockup,
} from "./components/animations/DeviceMockups";

// 3D Components
export {
  ThreeScene,
  FloatingGeometries,
  AnimatedCamera,
} from "./components/animations/ThreeScene";

// UI Mockups
export {
  FadeIn,
  SlideIn,
  ScaleIn,
  WordByWord,
  LogoAnimation,
  NotificationCard,
  FeatureCard as UIFeatureCard,
  DashboardCard,
  ProgressCard,
  PhoneMockup,
  LaptopMockup,
  AnimatedHeading,
  AnimatedBody,
} from "./components/DemoUIMockups";

// Templates
export {
  IntroScene,
  FeatureScene,
  CTAScene,
  buildVideoComposition,
  type VideoSceneConfig,
} from "./templates/SceneTemplates";

export {
  TechLaunchContent,
  AppShowcaseContent,
  type ProductData,
} from "./templates/TechTemplates";

// Hooks
export {
  useBeatMap,
  BeatMapProvider,
  type BeatMap,
} from "./hooks/useBeatMap";

// Audio Utilities
export {
  createBeatMapFromBPM,
  analyzeAudioFile,
  detectBeatsFromAudioData,
  type MusicTrack,
} from "../lib/audio/beatDetection";

// Skills System
export {
  getSkillContent,
  getCombinedSkillContent,
  SKILL_DETECTION_PROMPT,
  SKILL_NAMES,
  type SkillName,
} from "../lib/skills";

// Prompts
export {
  examplePrompts,
  SYSTEM_PROMPTS,
  getPromptsByCategory,
  type ExamplePrompt,
} from "../lib/prompts";
