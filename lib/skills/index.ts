// Skills System for Remotion Code Generation
// Provides AI with context-specific guidance for different animation types

// Import all skill markdown files
import threeDSkill from "./3d.md";
import chartsSkill from "./charts.md";
import typographySkill from "./typography.md";
import transitionsSkill from "./transitions.md";
import sequencingSkill from "./sequencing.md";
import springPhysicsSkill from "./spring-physics.md";
import socialMediaSkill from "./social-media.md";
import messagingSkill from "./messaging.md";

// Skill categories
export const GUIDANCE_SKILLS = [
  "charts",
  "typography",
  "social-media",
  "messaging",
  "3d",
  "transitions",
  "sequencing",
  "spring-physics",
] as const;

// Example skill IDs for code references
export const EXAMPLE_SKILLS = [
  "example-histogram",
  "example-progress-bar",
  "example-text-rotation",
  "example-falling-spheres",
  "example-animated-shapes",
  "example-lottie",
  "example-gold-price-chart",
  "example-typewriter-highlight",
  "example-word-carousel",
] as const;

export const SKILL_NAMES = [...GUIDANCE_SKILLS, ...EXAMPLE_SKILLS] as const;

export type SkillName = (typeof SKILL_NAMES)[number];

// Map skill names to their markdown content
const skillContentMap: Record<(typeof GUIDANCE_SKILLS)[number], string> = {
  charts: chartsSkill,
  typography: typographySkill,
  "social-media": socialMediaSkill,
  messaging: messagingSkill,
  "3d": threeDSkill,
  transitions: transitionsSkill,
  sequencing: sequencingSkill,
  "spring-physics": springPhysicsSkill,
};

/**
 * Get the content for a specific skill
 */
export function getSkillContent(skillName: SkillName): string {
  if (skillName.startsWith("example-")) {
    // Example skills would be loaded from example files
    // For now, return empty - these would reference actual code examples
    return "";
  }
  
  return skillContentMap[skillName as (typeof GUIDANCE_SKILLS)[number]] || "";
}

/**
 * Get combined content for multiple skills
 */
export function getCombinedSkillContent(skills: SkillName[]): string {
  if (skills.length === 0) return "";
  
  const contents = skills
    .map((skill) => getSkillContent(skill))
    .filter((content) => content.length > 0);
  
  return contents.join("\n\n---\n\n");
}

/**
 * Prompt for skill detection - used by AI to classify prompts
 */
export const SKILL_DETECTION_PROMPT = `Classify this motion graphics prompt into ALL applicable categories.
A prompt can match multiple categories. Only include categories that are clearly relevant.

Guidance categories (patterns and rules):
- charts: data visualizations, graphs, histograms, bar charts, pie charts, progress bars, statistics, metrics
- typography: kinetic text, typewriter effects, text animations, word carousels, animated titles, text-heavy content
- social-media: Instagram stories, TikTok content, YouTube shorts, social media posts, reels, vertical video
- messaging: chat interfaces, WhatsApp conversations, iMessage, chat bubbles, text messages, DMs, messenger
- 3d: 3D objects, ThreeJS, spatial animations, rotating cubes, 3D scenes
- transitions: scene changes, fades between clips, slide transitions, wipes, multiple scenes
- sequencing: multiple elements appearing at different times, staggered animations, choreographed entrances
- spring-physics: bouncy animations, organic motion, elastic effects, overshoot animations

Return an array of matching category names. Return an empty array if none apply.`;
