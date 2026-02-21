import {
  chatWithKimi,
  chatWithKimiVision,
  SCRAPER_CONFIG,
} from "./model";
import type { ProductData } from "../types";
import type { VideoGenerationStateType } from "./state";
import { scrapeUrl, isScraperServiceAvailable } from "../scraper/scraperClient";
import type { ScrapeResult, ScreenshotData } from "../scraper/scraperClient";
import { getCachedScrapeResult, setCachedScrapeResult } from "../cache/scrapeCache";

const SCRAPER_SYSTEM_PROMPT = `You are a product analyst specializing in extracting marketing information from websites.
Given a URL and its rendered content (HTML + page text), extract:
- Product name and tagline
- Key features and benefits (up to 5)
- Pricing information if available
- Social proof (testimonials, reviews, stats)
- Brand colors (analyze the CSS/design and extract primary, secondary, accent colors as hex values)
- Target audience and tone (professional, playful, minimal, or bold)
- Product type: Determine if this is a "saas" (software/app), "ecommerce" (physical products), "service", or "other"

Output ONLY valid JSON matching this exact schema:
{
  "name": "string",
  "tagline": "string",
  "description": "string",
  "productType": "saas" | "ecommerce" | "service" | "other",
  "features": [{"title": "string", "description": "string", "icon": "optional string"}],
  "pricing": [{"tier": "string", "price": "string", "features": ["string"]}] | null,
  "testimonials": [{"quote": "string", "author": "string", "role": "string"}] | null,
  "images": ["url strings"],
  "colors": {"primary": "#hex", "secondary": "#hex", "accent": "#hex"},
  "tone": "professional" | "playful" | "minimal" | "bold"
}

Focus on compelling marketing angles that would work well in a video.
If you cannot determine certain values, make reasonable inferences based on the content.`;

function createProductDataFromDescription(description: string): ProductData {
  return {
    name: "Your Product",
    tagline: description.slice(0, 100),
    description: description,
    features: [
      { title: "Feature 1", description: "Key benefit of your product" },
      { title: "Feature 2", description: "Another important feature" },
      { title: "Feature 3", description: "What makes you unique" },
    ],
    images: [],
    colors: {
      primary: "#3B82F6",
      secondary: "#1E40AF",
      accent: "#60A5FA",
    },
    tone: "professional",
  };
}

async function callModel(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  console.log("[Scraper] Calling Kimi K2.5...");
  console.log(`[Scraper] User message length: ${userMessage.length} chars`);

  const response = await chatWithKimi(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    SCRAPER_CONFIG,
  );

  console.log("[Scraper] Kimi Response length:", response.content.length);

  return response.content;
}

// Analyze screenshot with Kimi Vision for design insights
async function analyzeScreenshotForDesign(screenshotUrl: string): Promise<{
  designInsights: string;
  colorPalette: string[];
  layoutStyle: string;
  visualMood: string;
}> {
  console.log("[Scraper] Analyzing screenshot with Kimi Vision...");

  const prompt = `Analyze this website screenshot for video production:

1. DESIGN STYLE: What visual style does this website use? (minimal, bold, corporate, playful, tech, etc.)
2. COLOR PALETTE: List the 4-5 dominant colors as hex codes
3. LAYOUT: Describe the layout approach (grid, centered, asymmetric, bento, etc.)
4. VISUAL MOOD: What feeling/emotion does this design convey?
5. KEY VISUAL ELEMENTS: What unique design elements stand out? (gradients, shadows, animations hints, icons, typography)
6. VIDEO IDEAS: Based on this design, suggest 3 visual concepts for a promotional video

Return as JSON:
{
  "designStyle": "string",
  "colorPalette": ["#hex1", "#hex2", ...],
  "layout": "string",
  "visualMood": "string",
  "keyElements": ["element1", "element2", ...],
  "videoIdeas": ["idea1", "idea2", "idea3"],
  "summary": "Brief design analysis"
}`;

  try {
    // Use the screenshot URL or path for vision analysis
    const mediaInput = screenshotUrl.startsWith("http")
      ? { type: "image" as const, path: screenshotUrl }
      : { type: "image" as const, path: screenshotUrl };

    const response = await chatWithKimiVision(
      mediaInput,
      prompt,
      "You are a design analyst specializing in web and video production.",
      SCRAPER_CONFIG,
    );

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return {
        designInsights: analysis.summary || "",
        colorPalette: analysis.colorPalette || [],
        layoutStyle: analysis.layout || "centered",
        visualMood: analysis.visualMood || "professional",
      };
    }
  } catch (error) {
    console.error("[Scraper] Screenshot analysis error:", error);
  }

  return {
    designInsights: "",
    colorPalette: [],
    layoutStyle: "centered",
    visualMood: "professional",
  };
}

/**
 * Fallback scraper using Puppeteer directly (when scraper service is unavailable)
 */
async function scrapeWebsiteFallback(url: string): Promise<ScrapeResult> {
  // Dynamic import to avoid loading puppeteer if service is available
  const puppeteer = await import("puppeteer");
  const path = await import("path");
  const fs = await import("fs");

  const SCREENSHOTS_DIR = path.join(process.cwd(), "public", "screenshots");
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const sessionId = `scrape-${Date.now()}`;
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Take hero screenshot
    const heroPath = path.join(SCREENSHOTS_DIR, `${sessionId}-hero.png`);
    await page.screenshot({ path: heroPath, fullPage: false, type: "png" });

    const screenshots: ScreenshotData[] = [{
      name: `${sessionId}-hero.png`,
      path: heroPath,
      url: `/screenshots/${sessionId}-hero.png`,
      section: "hero",
      description: "Hero section",
    }];

    const content = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const images = Array.from(document.querySelectorAll("img"))
        .map((img) => img.src)
        .filter((src) => src && src.startsWith("http"))
        .slice(0, 10);
      const title = document.title;
      const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
      const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute("content") || "";
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";

      return {
        bodyText: bodyText.slice(0, 15000),
        images: ogImage ? [ogImage, ...images] : images,
        title,
        metaDesc,
        ogTitle,
        ogDesc,
      };
    });

    return {
      text: `Title: ${content.title}\nMeta Description: ${content.metaDesc}\nOG Title: ${content.ogTitle}\nOG Description: ${content.ogDesc}\n\nPage Content:\n${content.bodyText}`,
      images: content.images,
      title: content.title,
      screenshots,
      saasIndicators: { hasDemoButton: false, hasPricing: false, hasSignup: false },
    };
  } finally {
    await browser.close();
  }
}

export async function scraperNode(
  state: VideoGenerationStateType,
): Promise<Partial<VideoGenerationStateType>> {
  console.log("[Scraper] Starting scraper node...");

  try {
    // If only description is provided, create basic product data
    if (!state.sourceUrl && state.description) {
      console.log("[Scraper] No URL provided, using description only");
      const productData = createProductDataFromDescription(state.description);
      return {
        productData,
        currentStep: "scripting",
      };
    }

    if (!state.sourceUrl) {
      return {
        errors: ["No URL or description provided"],
        currentStep: "error",
      };
    }

    console.log(`[Scraper] Scraping URL: ${state.sourceUrl}`);

    // Check cache first (saves 15-25s for repeat URLs)
    const cached = await getCachedScrapeResult(state.sourceUrl);
    if (cached) {
      console.log("[Scraper] Using cached result");
      return {
        productData: cached,
        currentStep: "scripting",
      };
    }

    // Try scraper service first, fallback to direct Puppeteer
    let scrapeResult: ScrapeResult;
    const serviceAvailable = await isScraperServiceAvailable();

    if (serviceAvailable) {
      console.log("[Scraper] Using scraper service...");
      scrapeResult = await scrapeUrl(state.sourceUrl);
    } else {
      console.log("[Scraper] Scraper service unavailable, using direct Puppeteer fallback...");
      scrapeResult = await scrapeWebsiteFallback(state.sourceUrl);
    }

    const { text, images, title, screenshots } = scrapeResult;

    console.log(
      `[Scraper] Scraped ${text.length} chars, ${images.length} images, ${screenshots.length} screenshots`,
    );

    // Get hero screenshot for visual analysis
    const heroScreenshot = screenshots.find((s) => s.section === "hero");

    // PARALLEL: Run vision analysis + text analysis simultaneously (saves 5-10s)
    console.log("[Scraper] Running vision + text analysis in parallel...");

    const userMessage = `Analyze this website and extract product information:

URL: ${state.sourceUrl}
Page Title: ${title}

${state.description ? `Additional context from user: ${state.description}\n\n` : ""}

Page Content:
${text}

Found Images:
${images.join("\n")}

Determine if this is a SaaS product, ecommerce site, service, or other.
Return ONLY valid JSON.`;

    const [designAnalysis, responseText] = await Promise.all([
      // Vision analysis (if hero screenshot available)
      heroScreenshot
        ? analyzeScreenshotForDesign(heroScreenshot.path || heroScreenshot.url)
        : Promise.resolve({
            designInsights: "",
            colorPalette: [] as string[],
            layoutStyle: "centered",
            visualMood: "professional",
          }),
      // Text analysis (LLM extraction)
      callModel(SCRAPER_SYSTEM_PROMPT, userMessage),
    ]);

    console.log("[Scraper] Parallel analysis complete");
    console.log("[Scraper] Design insights:", designAnalysis.designInsights);

    // Extract JSON from response
    console.log("[Scraper] Attempting to extract JSON from response...");
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[Scraper] No JSON found in response!");
      throw new Error("Failed to extract JSON from response");
    }

    const productData = JSON.parse(jsonMatch[0]) as ProductData & {
      productType?: string;
      screenshots?: ScreenshotData[];
      designInsights?: string;
      visualMood?: string;
    };

    // Merge scraped images
    if (productData.images.length === 0 && images.length > 0) {
      productData.images = images.slice(0, 5);
    }

    // Override colors from visual analysis if available
    if (designAnalysis.colorPalette.length >= 3) {
      productData.colors = {
        primary: designAnalysis.colorPalette[0],
        secondary: designAnalysis.colorPalette[1],
        accent: designAnalysis.colorPalette[2],
      };
    }

    productData.designInsights = designAnalysis.designInsights;
    productData.visualMood = designAnalysis.visualMood;
    productData.screenshots = screenshots;

    // Log screenshot URLs for video usage
    console.log("[Scraper] Screenshots available for video:");
    for (const screenshot of screenshots) {
      console.log(`  - ${screenshot.section}: ${screenshot.url}`);
    }

    console.log("[Scraper] Extracted product name:", productData.name);
    console.log("[Scraper] Product type:", productData.productType || "unknown");

    // Cache the result for future requests
    await setCachedScrapeResult(state.sourceUrl, productData);

    return {
      productData,
      currentStep: "scripting",
    };
  } catch (error) {
    console.error("[Scraper] Error:", error);
    return {
      errors: [
        `Scraper error: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
      currentStep: "error",
    };
  }
}
