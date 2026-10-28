export type PlanId = "FREE" | "STARTER" | "CREATOR" | "PRO" | "AGENCY";
export interface Plan {
  id: PlanId; name: string; monthlyUsd: number; annualMonthlyUsd: number;
  channels: number; videosPerMonth: number; platforms: number | "all";
  features: string[]; rerendersPerVideo: number; maxDurationSec: number;
  quality: "draft" | "standard" | "premium"; watermark: boolean; voiceClone: boolean; radar: "limited" | "full";
  popular?: boolean;
}
export const PLANS: Plan[] = [
  { id: "FREE", name: "Free", monthlyUsd: 0, annualMonthlyUsd: 0, channels: 1, videosPerMonth: 3, platforms: 0, rerendersPerVideo: 1, maxDurationSec: 45, quality: "draft", watermark: true, voiceClone: false, radar: "limited", features: ["1 channel kit", "3 watermarked videos", "Idea feed (limited)", "No auto-post"] },
  { id: "STARTER", name: "Starter", monthlyUsd: 24, annualMonthlyUsd: 19, channels: 1, videosPerMonth: 30, platforms: 3, rerendersPerVideo: 3, maxDurationSec: 60, quality: "standard", watermark: false, voiceClone: false, radar: "full", features: ["1 channel", "30 videos / month", "Post to 3 platforms", "Niche radar + idea queue", "Library voices", "Free re-renders"] },
  { id: "CREATOR", name: "Creator", monthlyUsd: 49, annualMonthlyUsd: 39, channels: 2, videosPerMonth: 60, platforms: "all", rerendersPerVideo: 3, maxDurationSec: 90, quality: "standard", watermark: false, voiceClone: true, radar: "full", popular: true, features: ["2 channels", "60 videos / month", "All platforms", "Voice clone", "Trend radar + series autopilot", "Originality check", "60–90s TikTok mode"] },
  { id: "PRO", name: "Pro", monthlyUsd: 99, annualMonthlyUsd: 79, channels: 5, videosPerMonth: 150, platforms: "all", rerendersPerVideo: 5, maxDurationSec: 90, quality: "premium", watermark: false, voiceClone: true, radar: "full", features: ["5 channels", "150 videos / month", "Premium quality (Opus critic)", "Priority render", "Analytics loop"] },
  { id: "AGENCY", name: "Agency", monthlyUsd: 199, annualMonthlyUsd: 159, channels: 15, videosPerMonth: 400, platforms: "all", rerendersPerVideo: 5, maxDurationSec: 90, quality: "premium", watermark: false, voiceClone: true, radar: "full", features: ["15 channels", "400 videos / month", "Seats + client workspaces", "Everything in Pro"] },
];
export const ADDONS = [
  { id: "AI_VIDEO_CLIPS_10", name: "10 AI video clips", usd: 12, credits: 10 },
  { id: "CUSTOM_MUSIC_10", name: "10 custom music tracks", usd: 5, credits: 10 },
];
export function getPlan(id: string): Plan { return PLANS.find((p) => p.id === id) ?? PLANS[0]; }
