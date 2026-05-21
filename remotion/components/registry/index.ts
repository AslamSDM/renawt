// AUTO-GENERATED — do not edit by hand. See scripts/generate-registry.mjs.
import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Audio,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
} from "remotion";
import { applyAnim } from "./_helpers";

import { GradientBg } from "./GradientBg";
import { SolidBg } from "./SolidBg";
import { ImageBg } from "./ImageBg";
import { Title } from "./Title";
import { Subtitle } from "./Subtitle";
import { BulletList } from "./BulletList";
import { FeatureCard } from "./FeatureCard";
import { CTABanner } from "./CTABanner";
import { RecordingClip } from "./RecordingClip";
import { Logo } from "./Logo";
import { Box } from "./Box";
import { AnimatedGradient } from "./AnimatedGradient";
import { GridBg } from "./GridBg";
import { RadialGradientBg } from "./RadialGradientBg";
import { TypewriterText } from "./TypewriterText";
import { GradientText } from "./GradientText";
import { WordStagger } from "./WordStagger";
import { NumberCounter } from "./NumberCounter";
import { Quote } from "./Quote";
import { TestimonialCard } from "./TestimonialCard";
import { StatCard } from "./StatCard";
import { PhoneMockup } from "./PhoneMockup";
import { BrowserMockup } from "./BrowserMockup";
import { ProgressBar } from "./ProgressBar";
import { IconLabel } from "./IconLabel";
import { NotificationToast } from "./NotificationToast";
import { CodeBlock } from "./CodeBlock";
import { Spotlight } from "./Spotlight";
import { Circle } from "./Circle";
import { Divider } from "./Divider";

export const REGISTRY: Record<string, React.FC<any>> = {
  GradientBg,
  SolidBg,
  ImageBg,
  Title,
  Subtitle,
  BulletList,
  FeatureCard,
  CTABanner,
  RecordingClip,
  Logo,
  Box,
  AnimatedGradient,
  GridBg,
  RadialGradientBg,
  TypewriterText,
  GradientText,
  WordStagger,
  NumberCounter,
  Quote,
  TestimonialCard,
  StatCard,
  PhoneMockup,
  BrowserMockup,
  ProgressBar,
  IconLabel,
  NotificationToast,
  CodeBlock,
  Spotlight,
  Circle,
  Divider,
};

export type RegistryName = keyof typeof REGISTRY;
