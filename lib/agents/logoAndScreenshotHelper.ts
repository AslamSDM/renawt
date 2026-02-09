import puppeteer, { Page } from "puppeteer";
import * as path from "path";
import * as fs from "fs";
import { chatWithKimiVision } from "./model";

const SCREENSHOTS_DIR = path.join(process.cwd(), "public", "screenshots");

interface LogoData {
  url: string;
  source: "navbar" | "footer" | "favicon" | "manifest";
  confidence: number;
}

interface ScreenshotAnalysis {
  description: string;
  keyElements: string[];
  textContent: string;
  visualHierarchy: string;
  suggestedCaptions: string[];
}

/**
 * Extract logos from website (navbar, footer, favicon, manifest)
 */
export async function extractLogos(page: Page, baseUrl: string): Promise<LogoData[]> {
  const logos: LogoData[] = [];

  try {
    // 1. Look for logo in navbar
    const navbarLogos = await page.evaluate(() => {
      const selectors = [
        'nav img[src*="logo"]',
        'nav img[alt*="logo" i]',
        'header img[src*="logo"]',
        'header img[alt*="logo" i]',
        '[class*="logo"] img',
        '[class*="brand"] img',
        'a[href="/"] img',
        'a[href="./"] img',
        'nav svg[class*="logo"]',
        'header svg[class*="logo"]',
      ];

      const found: string[] = [];
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el.tagName === 'IMG') {
            const src = (el as HTMLImageElement).src;
            if (src && !src.startsWith('data:')) found.push(src);
          } else if (el.tagName === 'SVG') {
            // Convert SVG to data URL
            const svgData = new XMLSerializer().serializeToString(el);
            const dataUrl = 'data:image/svg+xml;base64,' + btoa(svgData);
            found.push(dataUrl);
          }
        });
      }
      return found.slice(0, 3); // Top 3 logos from navbar
    });

    navbarLogos.forEach(url => {
      logos.push({ url, source: "navbar", confidence: 0.9 });
    });

    // 2. Look for logo in footer
    const footerLogos = await page.evaluate(() => {
      const selectors = [
        'footer img[src*="logo"]',
        'footer img[alt*="logo" i]',
        '[class*="footer"] img[alt*="logo" i]',
      ];

      const found: string[] = [];
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const src = (el as HTMLImageElement).src;
          if (src && !src.startsWith('data:')) found.push(src);
        });
      }
      return found.slice(0, 2);
    });

    footerLogos.forEach(url => {
      if (!logos.find(l => l.url === url)) {
        logos.push({ url, source: "footer", confidence: 0.7 });
      }
    });

    // 3. Check for favicon
    const favicon = await page.evaluate(() => {
      const link = document.querySelector('link[rel*="icon"]');
      return link ? (link as HTMLLinkElement).href : null;
    });

    if (favicon && !logos.find(l => l.url === favicon)) {
      logos.push({ url: favicon, source: "favicon", confidence: 0.6 });
    }

    // 4. Check for manifest.json icons
    try {
      const manifestUrl = new URL('/manifest.json', baseUrl).href;
      const manifestResponse = await page.evaluate(async (url) => {
        try {
          const response = await fetch(url);
          return response.ok ? await response.json() : null;
        } catch {
          return null;
        }
      }, manifestUrl);

      if (manifestResponse?.icons?.length > 0) {
        const icon = manifestResponse.icons[0];
        const iconUrl = new URL(icon.src, baseUrl).href;
        if (!logos.find(l => l.url === iconUrl)) {
          logos.push({ url: iconUrl, source: "manifest", confidence: 0.8 });
        }
      }
    } catch {
      // Manifest fetch failed, continue
    }

  } catch (error) {
    console.error("[Logo Extractor] Error extracting logos:", error);
  }

  return logos;
}

/**
 * Analyze screenshot using Kimi Vision to generate descriptions and captions
 */
export async function analyzeScreenshot(
  screenshotPath: string,
  section: string
): Promise<ScreenshotAnalysis> {
  try {
    // Read screenshot as base64
    const imageBuffer = fs.readFileSync(screenshotPath);
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    const prompt = `Analyze this ${section} screenshot of a website/product. Provide:
1. A detailed description of what's shown
2. Key visual elements (buttons, text, images, layout)
3. Main text content visible
4. Visual hierarchy assessment
5. Three suggested marketing captions for a video

Format as JSON:
{
  "description": "string",
  "keyElements": ["string"],
  "textContent": "string",
  "visualHierarchy": "string",
  "suggestedCaptions": ["string", "string", "string"]
}`;

    const mediaInput = {
      type: "image" as const,
      base64: base64Image,
      mimeType: "image/png",
    };
    
    const response = await chatWithKimiVision(mediaInput, prompt);
    
    // Parse JSON from response content
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error("Could not parse analysis response");
  } catch (error) {
    console.error("[Screenshot Analyzer] Error analyzing screenshot:", error);
    return {
      description: `${section} screenshot`,
      keyElements: [],
      textContent: "",
      visualHierarchy: "standard",
      suggestedCaptions: [`Check out this ${section}`, `See our ${section} in action`, `Explore the ${section}`],
    };
  }
}

/**
 * Allow user to select which screenshots to keep
 */
export interface ScreenshotSelection {
  screenshot: {
    name: string;
    path: string;
    url: string;
    section: string;
    description: string;
  };
  analysis?: ScreenshotAnalysis;
  selected: boolean;
  order: number;
}

export function createScreenshotSelector(screenshots: any[]): ScreenshotSelection[] {
  return screenshots.map((screenshot, index) => ({
    screenshot,
    selected: true, // Default all selected
    order: index,
  }));
}

/**
 * Reorder screenshots based on user preference
 */
export function reorderScreenshots(
  selections: ScreenshotSelection[],
  newOrder: string[] // Array of screenshot names in desired order
): ScreenshotSelection[] {
  return newOrder.map((name, index) => {
    const selection = selections.find(s => s.screenshot.name === name);
    if (selection) {
      return { ...selection, order: index };
    }
    return null;
  }).filter(Boolean) as ScreenshotSelection[];
}
