import { Fraunces, Patrick_Hand, Space_Grotesk } from "next/font/google";

/** Display faces used by the SKIN_PRESETS. Loaded on the landing page only. */
export const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
export const patrickHand = Patrick_Hand({ subsets: ["latin"], weight: "400", variable: "--font-patrick-hand", display: "swap" });
export const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

export const skinFontVars = `${spaceGrotesk.variable} ${patrickHand.variable} ${fraunces.variable}`;

/** Map a kit font family name to a CSS font stack available on the page. */
export function fontStack(family: string): string {
  switch (family) {
    case "Inter":
      return "var(--font-sans)";
    case "EB Garamond":
      return "var(--font-serif)";
    case "JetBrains Mono":
      return "var(--font-mono)";
    case "Space Grotesk":
      return "var(--font-space-grotesk), var(--font-sans)";
    case "Patrick Hand":
      return "var(--font-patrick-hand), var(--font-sans)";
    case "Fraunces":
      return "var(--font-fraunces), var(--font-serif)";
    default:
      return "var(--font-sans)";
  }
}
