import puppeteer from "puppeteer";
import * as path from "path";
import * as fs from "fs";
import {
  chatWithKimi,
  chatWithKimiVision,
  SCRAPER_CONFIG,
} from "./model";
import type { ProductData } from "../types";
import type { VideoGenerationStateType } from "./state";

const SCRAPER_SYSTEM_PROMPT = `You are a product analyst specializing in extracting marketing information from websites.
Given a URL and its rendered content (HTML + page text), extract:
- Product name and tagline
- Key features and benefits (up to 5)
- Pricing information if available
- Social proof (testimonials, reviews, stats)
- Brand colors (analyze the CSS/design and extract primary, secondary, accent colors as hex values)
- Target audience and tone (professional, playful, minimal, or bold)

Output ONLY valid JSON matching this exact schema:
{
  "name": "string",
  "tagline": "string",
  "description": "string",
  "features": [{"title": "string", "description": "string", "icon": "optional string"}],
  "pricing": [{"tier": "string", "price": "string", "features": ["string"]}] | null,
  "testimonials": [{"quote": "string", "author": "string", "role": "string"}] | null,
  "images": ["url strings"],
  "colors": {"primary": "#hex", "secondary": "#hex", "accent": "#hex"},
  "tone": "professional" | "playful" | "minimal" | "bold"
}

Focus on compelling marketing angles that would work well in a video.
If you cannot determine certain values, make reasonable inferences based on the content.`;

async function scrapeWebsite(url: string): Promise<{
  text: string;
  images: string[];
  title: string;
  screenshotPath: string;
}> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Take a full-page screenshot for visual analysis
    const screenshotDir = path.join(process.cwd(), ".remotion-temp", "screenshots");
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    const screenshotPath = path.join(screenshotDir, `screenshot-${Date.now()}.png`);

    await page.screenshot({
      path: screenshotPath,
      fullPage: false, // Just the viewport for faster analysis
      type: "png"
    });
    console.log(`[Scraper] Screenshot saved: ${screenshotPath}`);

    // Extract page content
    const content = await page.evaluate(() => {
      // Get all text content
      const bodyText = document.body.innerText;

      // Get all image URLs
      const images = Array.from(document.querySelectorAll("img"))
        .map((img) => img.src)
        .filter((src) => src && src.startsWith("http"))
        .slice(0, 10);

      // Get page title
      const title = document.title;

      // Get meta description
      const metaDesc =
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content") || "";

      // Get OpenGraph data
      const ogTitle =
        document
          .querySelector('meta[property="og:title"]')
          ?.getAttribute("content") || "";
      const ogDesc =
        document
          .querySelector('meta[property="og:description"]')
          ?.getAttribute("content") || "";
      const ogImage =
        document
          .querySelector('meta[property="og:image"]')
          ?.getAttribute("content") || "";

      return {
        bodyText: bodyText.slice(0, 15000), // Limit text length
        images: ogImage ? [ogImage, ...images] : images,
        title,
        metaDesc,
        ogTitle,
        ogDesc,
      };
    });

    return {
      text: `Title: ${content.title}
Meta Description: ${content.metaDesc}
OG Title: ${content.ogTitle}
OG Description: ${content.ogDesc}

Page Content:
${content.bodyText}`,
      images: content.images,
      title: content.title,
      screenshotPath,
    };
  } finally {
    await browser.close();
  }
}

function createProductDataFromDescription(description: string): ProductData {
  // Create basic product data from description when no URL is provided
  return {
    name: "Your Product",
    tagline: description.slice(0, 100),
    description: description,
    features: [
      {
        title: "Feature 1",
        description: "Key benefit of your product",
      },
      {
        title: "Feature 2",
        description: "Another important feature",
      },
      {
        title: "Feature 3",
        description: "What makes you unique",
      },
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
  console.log(
    "[Scraper] Kimi Response preview:",
    response.content.substring(0, 500),
  );

  return response.content;
}

// Analyze screenshot with Kimi Vision for design insights
async function analyzeScreenshotForDesign(screenshotPath: string): Promise<{
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
    const response = await chatWithKimiVision(
      { type: "image", path: screenshotPath },
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

export async function scraperNode(
  state: VideoGenerationStateType,
): Promise<Partial<VideoGenerationStateType>> {
  console.log("[Scraper] Starting scraper node with Kimi K2.5...");

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
    const { text, images, title, screenshotPath } = await scrapeWebsite(state.sourceUrl);

    console.log(
      `[Scraper] Scraped ${text.length} chars, ${images.length} images`,
    );

    // Analyze screenshot with Kimi Vision for design insights
    const designAnalysis = await analyzeScreenshotForDesign(screenshotPath);
    console.log("[Scraper] Design insights:", designAnalysis.designInsights);
    console.log("[Scraper] Visual mood:", designAnalysis.visualMood);

    const userMessage = `Analyze this website and extract product information:

URL: ${state.sourceUrl}
Page Title: ${title}

${state.description ? `Additional context from user: ${state.description}\n\n` : ""}

VISUAL ANALYSIS (from screenshot):
- Design Style: ${designAnalysis.layoutStyle}
- Visual Mood: ${designAnalysis.visualMood}
- Key Colors: ${designAnalysis.colorPalette.join(", ")}
- Design Notes: ${designAnalysis.designInsights}

Page Content:
${text}

Found Images:
${images.join("\n")}

Use the visual analysis to inform the colors and tone extraction.
Return ONLY valid JSON.`;

    const responseText = await callModel(SCRAPER_SYSTEM_PROMPT, userMessage);

    // Extract JSON from response
    console.log("[Scraper] Attempting to extract JSON from response...");
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[Scraper] No JSON found in response!");
      console.error("[Scraper] Full response:", responseText);
      throw new Error("Failed to extract JSON from response");
    }

    console.log("[Scraper] Extracted JSON length:", jsonMatch[0].length);
    console.log("[Scraper] JSON preview:", jsonMatch[0].substring(0, 300));

    const productData = JSON.parse(jsonMatch[0]) as ProductData;

    // Merge scraped images if they weren't in the response
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

    // Copy screenshot to public folder for Remotion to access
    const publicScreenshotsDir = path.join(process.cwd(), "public", "screenshots");
    if (!fs.existsSync(publicScreenshotsDir)) {
      fs.mkdirSync(publicScreenshotsDir, { recursive: true });
    }
    const screenshotFileName = `screenshot-${Date.now()}.png`;
    const publicScreenshotPath = path.join(publicScreenshotsDir, screenshotFileName);
    fs.copyFileSync(screenshotPath, publicScreenshotPath);
    console.log(`[Scraper] Screenshot copied to public folder: ${publicScreenshotPath}`);

    // Store design insights for video generation
    (productData as any).designInsights = designAnalysis.designInsights;
    (productData as any).visualMood = designAnalysis.visualMood;
    (productData as any).screenshotPath = screenshotPath;
    (productData as any).publicScreenshotPath = `/screenshots/${screenshotFileName}`;

    console.log("[Scraper] Extracted product name:", productData.name);
    console.log("[Scraper] Extracted tagline:", productData.tagline);
    console.log(
      "[Scraper] Extracted features count:",
      productData.features?.length || 0,
    );

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
