/**
 * BRAND ANALYSER AGENT
 *
 * Uses Gemini Flash Vision to deeply analyze a product website's visual identity and
 * extract a structured brand style guide for use in video generation.
 *
 * Extracts:
 * - Exact color palette (primary, secondary, accent, bg, text)
 * - Typography (font families, weights, sizes, style)
 * - Visual mood and personality
 * - Design patterns (cards, gradients, shapes, spacing)
 * - Recommended video style
 */

import { chatWithGeminiFlashVision, chatWithGeminiFlash } from "./model";
import type { ScreenshotData } from "../scraper/scraperClient";

export interface BrandStyle {
  // Color palette
  colors: {
    primary: string; // Main brand color (hex)
    secondary: string; // Secondary color (hex)
    accent: string; // CTA / highlight color (hex)
    background: string; // Main background (hex)
    text: string; // Main text color (hex)
    textMuted: string; // Muted/secondary text (hex)
    gradient?: string; // CSS gradient string if brand uses gradients
  };
  // Typography
  typography: {
    primaryFont: string; // Main font family name
    headingWeight: string; // "700" | "800" | "900"
    style: string; // "serif" | "sans-serif" | "display" | "monospace"
    letterSpacing: string; // "tight" | "normal" | "wide"
    textTransform: string; // "none" | "uppercase" | "capitalize"
  };
  // Visual mood
  mood: {
    tone: string; // "professional" | "playful" | "luxury" | "minimal" | "bold" | "technical" | "energetic"
    energy: string; // "low" | "medium" | "high"
    personality: string; // e.g. "trustworthy", "innovative", "friendly"
    keywords: string[]; // 3-5 mood descriptors
  };
  // Design patterns observed on the site
  design: {
    style: string; // "flat" | "glassmorphism" | "neumorphism" | "gradient-heavy" | "editorial" | "minimal"
    cornerRadius: string; // "none" | "small" | "medium" | "large" | "pill"
    shadowStyle: string; // "none" | "subtle" | "dramatic" | "colored"
    usesGradients: boolean;
    usesDarkMode: boolean;
    dominantShapes: string; // e.g. "circles", "rectangles", "organic", "sharp"
  };
  // Video style recommendation
  videoStyle: {
    recommended: string; // "STYLE A — Dark Cinematic" | "STYLE B — Vibrant Brand" | "STYLE C — Editorial Clean" | "STYLE D — Neon Glow"
    cameraMovement: string; // e.g. "slow zoom with slight pan"
    textStyle: string; // e.g. "large condensed headlines, tight letter-spacing"
    backgroundApproach: string; // e.g. "dark bokeh with brand-colored light leaks"
    fontRecommendation: string; // Specific Google Font to use
  };
  // Raw insights for use in prompts
  designInsights: string;
  analysisConfidence: "high" | "medium" | "low";
}

const BRAND_ANALYSER_SYSTEM_PROMPT = `You are an expert brand strategist and visual designer specializing in analyzing websites for video production.

Analyze the website screenshot and extract a PRECISE brand style guide. Be specific — give exact hex codes, exact font names, and concrete visual descriptions.

Focus on:
1. EXACT color palette — extract hex values from what you see (backgrounds, buttons, text, accents)
2. TYPOGRAPHY — what font style/family appears to be used? Weight? Case?
3. VISUAL MOOD — what emotion does this brand convey?
4. DESIGN PATTERNS — flat/glass/gradient, shapes, shadows
5. VIDEO STYLE RECOMMENDATION — which of these 4 styles fits best:
   - STYLE A: Dark Cinematic (for tech, SaaS, professional)
   - STYLE B: Vibrant Brand (for bold, colorful, playful brands)
   - STYLE C: Editorial Clean (for health, finance, B2B)
   - STYLE D: Neon Glow (for gaming, crypto, energy)

Return ONLY valid JSON matching this schema:
{
  "colors": {
    "primary": "#hex",
    "secondary": "#hex", 
    "accent": "#hex",
    "background": "#hex",
    "text": "#hex",
    "textMuted": "#hex",
    "gradient": "linear-gradient(135deg, #hex1, #hex2) or null"
  },
  "typography": {
    "primaryFont": "Font name or best guess",
    "headingWeight": "700|800|900",
    "style": "serif|sans-serif|display|monospace",
    "letterSpacing": "tight|normal|wide",
    "textTransform": "none|uppercase|capitalize"
  },
  "mood": {
    "tone": "professional|playful|luxury|minimal|bold|technical|energetic",
    "energy": "low|medium|high",
    "personality": "one word e.g. trustworthy",
    "keywords": ["word1", "word2", "word3"]
  },
  "design": {
    "style": "flat|glassmorphism|neumorphism|gradient-heavy|editorial|minimal",
    "cornerRadius": "none|small|medium|large|pill",
    "shadowStyle": "none|subtle|dramatic|colored",
    "usesGradients": true|false,
    "usesDarkMode": true|false,
    "dominantShapes": "circles|rectangles|organic|sharp"
  },
  "videoStyle": {
    "recommended": "STYLE A — Dark Cinematic|STYLE B — Vibrant Brand|STYLE C — Editorial Clean|STYLE D — Neon Glow",
    "cameraMovement": "describe the ideal camera style",
    "textStyle": "describe ideal typography for video",
    "backgroundApproach": "describe the ideal background treatment",
    "fontRecommendation": "specific Google Font name e.g. Montserrat, Oswald, Playfair Display"
  },
  "designInsights": "2-3 sentence summary of the brand's visual identity",
  "analysisConfidence": "high|medium|low"
}`;

/**
 * Analyze a website screenshot to extract a full brand style guide.
 */
export async function analyseBrand(
  screenshot: ScreenshotData,
  productName: string,
  productDescription?: string,
): Promise<BrandStyle | null> {
  console.log(`[BrandAnalyser] Analyzing brand for: ${productName}`);

  const contextPrompt = `
Website screenshot for: ${productName}
${productDescription ? `Description: ${productDescription}` : ""}

Analyze this screenshot and extract the brand style guide. Be precise with color hex values.
If you cannot determine exact values, make educated inferences based on what you observe.
`;

  try {
    const screenshotPath = screenshot.path || screenshot.url;

    const response = await chatWithGeminiFlashVision(
      { type: "image", path: screenshotPath },
      contextPrompt,
      BRAND_ANALYSER_SYSTEM_PROMPT,
      { temperature: 0.2 }, // Low temperature for consistency
    );

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[BrandAnalyser] No JSON found in response");
      return null;
    }

    const brandStyle = JSON.parse(jsonMatch[0]) as BrandStyle;
    console.log(
      `[BrandAnalyser] ✅ Brand analysis complete — Style: ${brandStyle.videoStyle?.recommended}, Tone: ${brandStyle.mood?.tone}`,
    );
    console.log(
      `[BrandAnalyser] Primary color: ${brandStyle.colors?.primary}, Font: ${brandStyle.typography?.primaryFont}`,
    );

    return brandStyle;
  } catch (error) {
    console.error("[BrandAnalyser] Analysis failed:", error);
    return null;
  }
}

/**
 * Fallback brand style for when vision analysis fails.
 * Uses text-based product data to make reasonable style choices.
 */
export async function inferBrandStyleFromText(
  productName: string,
  productDescription: string,
  tone: string,
  colors: { primary?: string; secondary?: string; accent?: string },
): Promise<BrandStyle> {
  console.log("[BrandAnalyser] Inferring brand style from text data...");

  // Quick text-based inference using Gemini Flash
  const prompt = `Given this product, infer a brand style guide for video generation:

Product: ${productName}
Description: ${productDescription}
Tone: ${tone}
Known brand colors: ${JSON.stringify(colors)}

Return ONLY compact JSON matching this schema (same as brand analyser output).
Be opinionated and specific. Choose one strong visual direction.`;

  try {
    const response = await chatWithGeminiFlash(
      [
        { role: "system", content: BRAND_ANALYSER_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      { temperature: 0.3 },
    );

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as BrandStyle;
    }
  } catch (error) {
    console.error("[BrandAnalyser] Text inference failed:", error);
  }

  // Hard fallback
  return buildDefaultBrandStyle(tone, colors);
}

function buildDefaultBrandStyle(
  tone: string,
  colors: { primary?: string; secondary?: string; accent?: string },
): BrandStyle {
  const isDark = ["professional", "technical", "bold"].includes(tone);
  const isPlayful = ["playful", "energetic"].includes(tone);

  return {
    colors: {
      primary: colors.primary || "#3b82f6",
      secondary: colors.secondary || "#1e40af",
      accent: colors.accent || "#06b6d4",
      background: isDark ? "#08080f" : "#ffffff",
      text: isDark ? "#ffffff" : "#111827",
      textMuted: isDark ? "rgba(255,255,255,0.6)" : "#6b7280",
    },
    typography: {
      primaryFont: isPlayful ? "Poppins" : "Montserrat",
      headingWeight: "800",
      style: "sans-serif",
      letterSpacing: "tight",
      textTransform: "none",
    },
    mood: {
      tone: tone as any,
      energy: isPlayful ? "high" : "medium",
      personality: isDark ? "innovative" : "friendly",
      keywords: ["modern", "clean", "professional"],
    },
    design: {
      style: isDark ? "gradient-heavy" : "flat",
      cornerRadius: "medium",
      shadowStyle: isDark ? "dramatic" : "subtle",
      usesGradients: true,
      usesDarkMode: isDark,
      dominantShapes: "rectangles",
    },
    videoStyle: {
      recommended: isDark
        ? "STYLE A — Dark Cinematic"
        : isPlayful
          ? "STYLE B — Vibrant Brand"
          : "STYLE C — Editorial Clean",
      cameraMovement: "slow Ken Burns zoom with slight drift",
      textStyle:
        "large condensed headlines, tight letter-spacing, staggered reveal",
      backgroundApproach: isDark
        ? "dark background with colored bokeh light leaks"
        : "light background with subtle color accents",
      fontRecommendation: isPlayful ? "Poppins" : "Montserrat",
    },
    designInsights: `A ${tone} brand with ${isDark ? "dark" : "light"} aesthetic. Emphasis on clean typography and purposeful use of ${colors.primary || "blue"} as the primary color.`,
    analysisConfidence: "low",
  };
}

/**
 * Format brand style into a concise prompt section for video generation
 */
export function formatBrandStyleForPrompt(brand: BrandStyle): string {
  return `## ━━ BRAND STYLE GUIDE (extracted from real website) ━━

### COLORS (use these EXACTLY — do not invent new colors):
- Primary: ${brand.colors.primary}
- Secondary: ${brand.colors.secondary}
- Accent / CTA: ${brand.colors.accent}
- Background: ${brand.colors.background}
- Text: ${brand.colors.text}
- Muted text: ${brand.colors.textMuted}
${brand.colors.gradient ? `- Gradient: ${brand.colors.gradient}` : ""}

### TYPOGRAPHY:
- Font: Load "${brand.typography.primaryFont}" from @remotion/google-fonts (or closest available)
- Heading weight: ${brand.typography.headingWeight}
- Letter spacing: ${brand.typography.letterSpacing} (${brand.typography.letterSpacing === "tight" ? "-2 to -4px" : brand.typography.letterSpacing === "wide" ? "2-4px" : "0"})
- Text transform: ${brand.typography.textTransform}
- Recommended Google Font: ${brand.videoStyle.fontRecommendation}

### VISUAL MOOD:
- Tone: ${brand.mood.tone}, Energy: ${brand.mood.energy}
- Personality: ${brand.mood.personality}
- Keywords: ${brand.mood.keywords.join(", ")}

### DESIGN APPROACH:
- Style: ${brand.design.style}
- Uses dark mode: ${brand.design.usesDarkMode}
- Uses gradients: ${brand.design.usesGradients}
- Corner radius: ${brand.design.cornerRadius}
- Shadow style: ${brand.design.shadowStyle}

### VIDEO DIRECTION:
- Use: ${brand.videoStyle.recommended}
- Camera: ${brand.videoStyle.cameraMovement}
- Text style: ${brand.videoStyle.textStyle}
- Background: ${brand.videoStyle.backgroundApproach}

### BRAND INSIGHTS:
${brand.designInsights}

CRITICAL: Build the ENTIRE visual language around these exact colors and typography. Do NOT default to generic purple/pink or white glass cards.`;
}
