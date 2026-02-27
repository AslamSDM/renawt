/**
 * UI MOCKUP GENERATOR
 *
 * Analyzes scraped screenshots with Gemini Flash Vision to extract:
 * - Clickable UI components (buttons, inputs, cards, CTAs)
 * - Exact color palette from the actual product
 * - Layout structure and interactive elements
 * - Cursor animation sequence for the video
 *
 * Produces a structured UIMockupData that enriches the freestyle
 * code-gen prompt so compositions include realistic UI panels
 * with cursor-click animations instead of generic text-only videos.
 */

import { chatWithGeminiFlashVision } from "./model";
import type { ProductData, ScreenshotData } from "../types";

// ============================================
// Types
// ============================================

export interface UIComponent {
  type:
    | "button"
    | "input"
    | "card"
    | "dropdown"
    | "toggle"
    | "image-upload"
    | "panel"
    | "text-field"
    | "navbar"
    | "stat";
  label: string;
  style: {
    background: string;
    color: string;
    borderRadius: string;
    border?: string;
    fontSize?: string;
    fontWeight?: string;
    padding?: string;
  };
  isPrimary?: boolean; // Is this the main CTA?
  placeholder?: string; // For inputs
  icon?: string; // Emoji or description
}

export interface CursorAction {
  targetComponent: string; // label of the component to interact with
  action: "click" | "hover" | "type" | "scroll";
  typedText?: string; // What to type (for "type" action)
  delay: number; // frames to wait before this action starts (relative to scene start)
  duration: number; // frames this action takes
}

export interface UIMockupData {
  components: UIComponent[];
  colorPalette: {
    background: string;
    surface: string;
    primary: string;
    text: string;
    muted: string;
    accent?: string;
    glow?: string;
  };
  cursorSequence: CursorAction[];
  layoutDescription: string; // Natural language description for the code gen LLM
  productContext: {
    name: string;
    ticker?: string;
    tagline?: string;
    ctaText?: string;
  };
  panelStyle: {
    perspective: string;
    rotateX: number;
    rotateY: number;
    width: string;
    borderStyle: string;
  };
}

// ============================================
// Screenshot Analysis (Gemini Flash Vision)
// ============================================

const UI_ANALYSIS_PROMPT = `You are a UI/UX analyst. Analyze this product screenshot and extract the interactive elements that would look great animated in a promotional video.

Focus on:
1. CLICKABLE ELEMENTS: buttons, CTAs, links, toggles — what a cursor would click
2. INPUT FIELDS: text inputs, dropdowns, file uploads — what a user would interact with
3. COLOR PALETTE: Extract the EXACT colors from the UI (backgrounds, buttons, text, borders, accents)
4. LAYOUT: How are components arranged? (cards, panels, forms, grids)
5. INTERACTIVE STORY: What sequence of actions would a user take? (e.g., type name → select option → click button)

Return ONLY valid JSON:
{
  "components": [
    {
      "type": "button|input|card|dropdown|toggle|image-upload|panel|text-field|navbar|stat",
      "label": "exact text shown on the element",
      "style": {
        "background": "#hex or gradient description",
        "color": "#hex text color",
        "borderRadius": "e.g. 12px",
        "border": "e.g. 1px solid #333",
        "fontSize": "e.g. 24px",
        "fontWeight": "e.g. bold",
        "padding": "e.g. 16px 24px"
      },
      "isPrimary": true/false,
      "placeholder": "placeholder text if input",
      "icon": "emoji if applicable"
    }
  ],
  "colorPalette": {
    "background": "#hex (page/section background)",
    "surface": "#hex (card/panel background)",
    "primary": "#hex (main CTA/accent color)",
    "text": "#hex (primary text color)",
    "muted": "#hex (secondary/muted text)",
    "accent": "#hex (highlight/glow color)",
    "glow": "#hex (glow/shadow accent)"
  },
  "cursorSequence": [
    {
      "targetComponent": "component label",
      "action": "click|hover|type|scroll",
      "typedText": "text to type (if action=type)",
      "delay": 0,
      "duration": 30
    }
  ],
  "layoutDescription": "A single paragraph describing the UI layout, suitable for a code generator to recreate",
  "productContext": {
    "name": "product/feature name shown",
    "ticker": "ticker/short code if visible",
    "tagline": "tagline if visible",
    "ctaText": "main CTA button text"
  },
  "panelStyle": {
    "perspective": "1200px",
    "rotateX": 10,
    "rotateY": -5,
    "width": "800px",
    "borderStyle": "subtle glow or solid or dashed"
  }
}

IMPORTANT:
- Extract REAL colors from the screenshot, do NOT use generic defaults
- The cursor sequence should tell a compelling micro-story (fill form → click CTA)
- Keep components to 4-8 max (the most visually interesting ones)
- Delay values are in frames at 30fps (30 = 1 second)
- The first cursor action should start at delay 40+ (give the UI time to animate in)`;

/**
 * Analyze a single screenshot for UI components and interactions.
 */
async function analyzeScreenshotUI(
  screenshot: ScreenshotData,
  productData: ProductData,
): Promise<Partial<UIMockupData> | null> {
  console.log(
    `[UIMockup] Analyzing screenshot: ${screenshot.section} — ${screenshot.description}`,
  );

  const contextPrompt = `${UI_ANALYSIS_PROMPT}

PRODUCT CONTEXT:
- Name: ${productData.name}
- Tagline: ${productData.tagline}
- Brand Colors: ${JSON.stringify(productData.colors)}
- Tone: ${productData.tone}

Analyze this ${screenshot.section} section screenshot.`;

  try {
    const imagePath = screenshot.path || screenshot.url;
    const response = await chatWithGeminiFlashVision(
      { type: "image", path: imagePath },
      contextPrompt,
      undefined,
      { temperature: 0.3, maxTokens: 4000 },
    );

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[UIMockup] No JSON found in vision response");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed as Partial<UIMockupData>;
  } catch (error) {
    console.error("[UIMockup] Screenshot analysis error:", error);
    return null;
  }
}

// ============================================
// Main Entry Points
// ============================================

/**
 * Analyze scraped screenshots and produce structured UI mockup data.
 * Sends up to 3 screenshots to Gemini Flash Vision in parallel.
 */
export async function analyzeScreenshotsForUI(
  screenshots: ScreenshotData[],
  productData: ProductData,
): Promise<UIMockupData | null> {
  console.log(
    `[UIMockup] Starting UI analysis with ${screenshots.length} screenshots`,
  );

  if (!screenshots || screenshots.length === 0) {
    console.log("[UIMockup] No screenshots available, skipping UI analysis");
    return null;
  }

  // Prioritize: hero > ui > features > full. Take up to 3.
  const priorityOrder = ["hero", "ui", "features", "full", "pricing"];
  const sortedScreenshots = [...screenshots]
    .sort(
      (a, b) =>
        priorityOrder.indexOf(a.section) - priorityOrder.indexOf(b.section),
    )
    .slice(0, 3);

  console.log(
    `[UIMockup] Analyzing ${sortedScreenshots.length} screenshots:`,
    sortedScreenshots.map((s) => s.section),
  );

  // Analyze screenshots in parallel
  const results = await Promise.all(
    sortedScreenshots.map((screenshot) =>
      analyzeScreenshotUI(screenshot, productData),
    ),
  );

  // Merge results — pick the best one (most components found)
  const validResults = results.filter(
    (r): r is Partial<UIMockupData> => r !== null,
  );

  if (validResults.length === 0) {
    console.warn("[UIMockup] All screenshot analyses failed");
    return null;
  }

  // Pick the result with the most components
  const bestResult = validResults.reduce((best, current) => {
    const bestCount = best.components?.length || 0;
    const currentCount = current.components?.length || 0;
    return currentCount > bestCount ? current : best;
  });

  // Merge components from other results if they add unique ones
  const allComponents = new Map<string, UIComponent>();
  for (const result of validResults) {
    for (const comp of result.components || []) {
      if (!allComponents.has(comp.label)) {
        allComponents.set(comp.label, comp);
      }
    }
  }

  // Build final mockup data with defaults for any missing fields
  const mockupData: UIMockupData = {
    components: Array.from(allComponents.values()).slice(0, 8),
    colorPalette: bestResult.colorPalette || {
      background: productData.colors.primary,
      surface: "#111814",
      primary: productData.colors.accent,
      text: "#ffffff",
      muted: "#888888",
      accent: productData.colors.accent,
      glow: productData.colors.accent,
    },
    cursorSequence: bestResult.cursorSequence || [
      {
        targetComponent:
          bestResult.components?.find((c) => c.isPrimary)?.label || "Submit",
        action: "click",
        delay: 50,
        duration: 30,
      },
    ],
    layoutDescription:
      bestResult.layoutDescription ||
      "A sleek panel with form fields and a prominent CTA button",
    productContext: bestResult.productContext || {
      name: productData.name,
      tagline: productData.tagline,
      ctaText: "Get Started",
    },
    panelStyle: bestResult.panelStyle || {
      perspective: "1200px",
      rotateX: 10,
      rotateY: -5,
      width: "800px",
      borderStyle: "subtle glow",
    },
  };

  console.log(
    `[UIMockup] Analysis complete: ${mockupData.components.length} components, ${mockupData.cursorSequence.length} cursor actions`,
  );
  console.log(`[UIMockup] Colors:`, JSON.stringify(mockupData.colorPalette));

  return mockupData;
}

/**
 * Generate the prompt fragment that gets injected into the freestyle code-gen prompt.
 * This tells Gemini Pro exactly what UI to render and how the cursor should animate.
 */
export function generateMockupPromptSection(mockupData: UIMockupData): string {
  const componentsDesc = mockupData.components
    .map((c, i) => {
      let desc = `${i + 1}. **${c.type.toUpperCase()}**: "${c.label}"`;
      desc += ` — bg: ${c.style.background}, text: ${c.style.color}, rounded: ${c.style.borderRadius}`;
      if (c.isPrimary) desc += " ⭐ PRIMARY CTA";
      if (c.placeholder) desc += ` (placeholder: "${c.placeholder}")`;
      if (c.icon) desc += ` (icon: ${c.icon})`;
      return desc;
    })
    .join("\n");

  const cursorDesc = mockupData.cursorSequence
    .map((action, i) => {
      let desc = `${i + 1}. At frame +${action.delay}: ${action.action.toUpperCase()} on "${action.targetComponent}"`;
      if (action.typedText) desc += ` → type "${action.typedText}"`;
      desc += ` (duration: ${action.duration} frames)`;
      return desc;
    })
    .join("\n");

  return `
## 🎯 UI MOCKUP SCENE (MANDATORY — USE THIS DATA)

You MUST create a scene that renders this UI panel with cursor animation.
The data below comes from analyzing the actual product screenshots — use these EXACT colors and components.

### LAYOUT
${mockupData.layoutDescription}

### COMPONENTS TO RENDER
${componentsDesc}

### EXACT COLOR PALETTE (FROM SCREENSHOTS — DO NOT CHANGE)
- Page/Panel Background: ${mockupData.colorPalette.background}
- Card/Surface: ${mockupData.colorPalette.surface}
- Primary CTA: ${mockupData.colorPalette.primary}
- Text: ${mockupData.colorPalette.text}
- Muted/Secondary: ${mockupData.colorPalette.muted}
- Accent/Glow: ${mockupData.colorPalette.accent || mockupData.colorPalette.primary}
- Glow Effect: ${mockupData.colorPalette.glow || mockupData.colorPalette.primary}

### PRODUCT CONTEXT
- Product Name: ${mockupData.productContext.name}
${mockupData.productContext.ticker ? `- Ticker: ${mockupData.productContext.ticker}` : ""}
${mockupData.productContext.tagline ? `- Tagline: ${mockupData.productContext.tagline}` : ""}
${mockupData.productContext.ctaText ? `- CTA Button Text: "${mockupData.productContext.ctaText}"` : ""}

### 3D PANEL STYLE
- Perspective: ${mockupData.panelStyle.perspective}
- RotateX: ${mockupData.panelStyle.rotateX}deg, RotateY: ${mockupData.panelStyle.rotateY}deg
- Panel Width: ${mockupData.panelStyle.width}
- Border: ${mockupData.panelStyle.borderStyle}

### CURSOR ANIMATION SEQUENCE
The cursor MUST follow this exact interaction story:
${cursorDesc}

### IMPLEMENTATION PATTERN
Use this exact pattern for the UI scene:
1. \`AbsoluteFill\` with radial gradient background using palette colors
2. Apply \`perspective\` to container for 3D tilt effect
3. Animate panel entrance with \`spring()\`: scale 0.5→1, opacity 0→1, rotateX from 40→${mockupData.panelStyle.rotateX}
4. Render each component as styled \`<div>\` matching the palette
5. SVG cursor appears at frame 35, moves using \`interpolate()\` with \`Easing.out(Easing.cubic)\`
6. Click micro-animation: button \`scale(0.95)\` for 5 frames, then glow pulse via \`filter: brightness()\`
7. Post-click: CTA glows with \`boxShadow\` using the glow color

CURSOR SVG (use this exact SVG):
\`\`\`
<svg width="48" height="48" viewBox="0 0 24 24" fill="none">
  <path d="M5.5 3.21V20.8C5.5 21.46 6.26 21.84 6.78 21.43L11.64 17.65C11.83 17.5 12.07 17.42 12.31 17.42H18.73C19.39 17.42 19.76 16.65 19.34 16.15L6.68 3.12C6.23 2.65 5.5 2.97 5.5 3.21Z" fill="white" stroke="black" strokeWidth="1.5" strokeLinejoin="round"/>
</svg>
\`\`\`
`;
}
