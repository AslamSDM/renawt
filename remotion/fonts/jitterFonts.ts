/**
 * Pre-loaded Google Fonts for the Jitter pipeline.
 * Loading at module top-level ensures fonts are ready before any composition renders.
 */

import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadManrope } from "@remotion/google-fonts/Manrope";
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadSora } from "@remotion/google-fonts/Sora";
import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";
import { loadFont as loadDMSans } from "@remotion/google-fonts/DMSans";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadPlayfairDisplay } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadBebasNeue } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";

type FontWeight =
  | "100"
  | "200"
  | "300"
  | "400"
  | "500"
  | "600"
  | "700"
  | "800"
  | "900";

const HEAVY_RANGE: FontWeight[] = [
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
];

const inter = loadInter("normal", {
  weights: HEAVY_RANGE,
  subsets: ["latin"],
});
const spaceGrotesk = loadSpaceGrotesk("normal", {
  weights: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});
const manrope = loadManrope("normal", {
  weights: ["200", "300", "400", "500", "600", "700", "800"],
  subsets: ["latin"],
});
const geist = loadGeist("normal", {
  weights: HEAVY_RANGE,
  subsets: ["latin"],
});
const sora = loadSora("normal", {
  weights: ["100", "200", "300", "400", "500", "600", "700", "800"],
  subsets: ["latin"],
});
const outfit = loadOutfit("normal", {
  weights: HEAVY_RANGE,
  subsets: ["latin"],
});
const dmSans = loadDMSans("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin"],
});
const poppins = loadPoppins("normal", {
  weights: HEAVY_RANGE,
  subsets: ["latin"],
});
const playfair = loadPlayfairDisplay("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});
const bebas = loadBebasNeue("normal", { weights: ["400"], subsets: ["latin"] });
const montserrat = loadMontserrat("normal", {
  weights: HEAVY_RANGE,
  subsets: ["latin"],
});

/** Map of canonical name → loaded family string. Names are also valid aliases. */
export const JITTER_FONT_FAMILIES: Record<string, string> = {
  Inter: inter.fontFamily,
  "Space Grotesk": spaceGrotesk.fontFamily,
  Manrope: manrope.fontFamily,
  Geist: geist.fontFamily,
  Sora: sora.fontFamily,
  Outfit: outfit.fontFamily,
  "DM Sans": dmSans.fontFamily,
  Poppins: poppins.fontFamily,
  "Playfair Display": playfair.fontFamily,
  "Bebas Neue": bebas.fontFamily,
  Montserrat: montserrat.fontFamily,
};

/** Names suitable for the agent to pick from. Keep this in sync with the map. */
export const AVAILABLE_FONTS = Object.keys(JITTER_FONT_FAMILIES);

/**
 * Resolve a user-provided font name to a real loaded family string.
 * - Exact match (case-insensitive) wins.
 * - "SF Pro", "Apple", "System" → native Apple system stack.
 * - Unknown name → Inter.
 */
export function resolveFontFamily(name?: string): string {
  if (!name) return JITTER_FONT_FAMILIES.Inter;
  const trimmed = name.trim();
  // Apple system stack — closest to SF Pro that Apple uses
  if (/^(sf\s|sf-|apple|system|-apple)/i.test(trimmed)) {
    return `-apple-system, BlinkMacSystemFont, "${JITTER_FONT_FAMILIES.Inter}", sans-serif`;
  }
  const lower = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(JITTER_FONT_FAMILIES)) {
    if (key.toLowerCase() === lower) return value;
  }
  return JITTER_FONT_FAMILIES.Inter;
}
