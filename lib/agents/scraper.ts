import puppeteer, { Page } from "puppeteer";
import * as path from "path";
import * as fs from "fs";
import {
  chatWithKimi,
  chatWithKimiVision,
  SCRAPER_CONFIG,
} from "./model";
import type { ProductData } from "../types";
import type { VideoGenerationStateType } from "./state";
import { uploadScreenshotToR2, isR2Configured } from "../storage/r2";
import { extractLogos } from "./logoAndScreenshotHelper";

// Directory for storing screenshots (served statically)
const SCREENSHOTS_DIR = path.join(process.cwd(), "public", "screenshots");

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

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

interface ScreenshotData {
  name: string;
  path: string;
  url: string;
  section: "hero" | "features" | "pricing" | "testimonials" | "footer" | "full" | "ui";
  description: string;
}

interface ScrapeResult {
  text: string;
  images: string[];
  title: string;
  screenshots: ScreenshotData[];
  logos: Array<{ url: string; source: string; confidence: number }>;
}

/**
 * Take a screenshot of a specific viewport/section
 */
async function takeScreenshot(
  page: Page,
  sessionId: string,
  section: ScreenshotData["section"],
  description: string
): Promise<ScreenshotData> {
  const filename = `${sessionId}-${section}-${Date.now()}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);

  await page.screenshot({
    path: filepath,
    fullPage: false,
    type: "png",
  });

  console.log(`[Scraper] Screenshot saved: ${section} - ${filepath}`);

  return {
    name: filename,
    path: filepath,
    url: `/screenshots/${filename}`,
    section,
    description,
  };
}

/**
 * Scroll to a specific section and take a screenshot
 */
async function scrollAndCapture(
  page: Page,
  sessionId: string,
  selector: string,
  section: ScreenshotData["section"],
  description: string
): Promise<ScreenshotData | null> {
  try {
    const element = await page.$(selector);
    if (element) {
      await element.scrollIntoView();
      await new Promise(r => setTimeout(r, 1500)); // Wait for scroll animations and lazy-loaded content
      return await takeScreenshot(page, sessionId, section, description);
    }
  } catch (error) {
    console.log(`[Scraper] Could not capture ${section}: ${error}`);
  }
  return null;
}

/**
 * Capture multiple screenshots for SaaS products
 */
async function captureSaaSScreenshots(
  page: Page,
  sessionId: string
): Promise<ScreenshotData[]> {
  const screenshots: ScreenshotData[] = [];

  // 1. Hero section (initial viewport)
  console.log("[Scraper] Capturing hero section...");
  screenshots.push(await takeScreenshot(page, sessionId, "hero", "Hero section - main headline and CTA"));

  // 2. Scroll down to capture features section
  console.log("[Scraper] Looking for features section...");
  const featureSelectors = [
    '[class*="feature"]',
    '[id*="feature"]',
    '[class*="benefit"]',
    '[class*="solution"]',
    'section:nth-of-type(2)',
    '#features',
  ];

  for (const selector of featureSelectors) {
    const screenshot = await scrollAndCapture(page, sessionId, selector, "features", "Features section - key product capabilities");
    if (screenshot) {
      screenshots.push(screenshot);
      break;
    }
  }

  // 3. Pricing section
  console.log("[Scraper] Looking for pricing section...");
  const pricingSelectors = [
    '[class*="pricing"]',
    '[id*="pricing"]',
    '[class*="plans"]',
    '#pricing',
  ];

  for (const selector of pricingSelectors) {
    const screenshot = await scrollAndCapture(page, sessionId, selector, "pricing", "Pricing section - plans and costs");
    if (screenshot) {
      screenshots.push(screenshot);
      break;
    }
  }

  // 4. Testimonials section
  console.log("[Scraper] Looking for testimonials section...");
  const testimonialSelectors = [
    '[class*="testimonial"]',
    '[class*="review"]',
    '[class*="customer"]',
    '[id*="testimonial"]',
    '#testimonials',
  ];

  for (const selector of testimonialSelectors) {
    const screenshot = await scrollAndCapture(page, sessionId, selector, "testimonials", "Testimonials - social proof");
    if (screenshot) {
      screenshots.push(screenshot);
      break;
    }
  }

  // 5. Full page screenshot for reference
  console.log("[Scraper] Capturing full page...");
  const fullPagePath = path.join(SCREENSHOTS_DIR, `${sessionId}-full.png`);
  await page.screenshot({
    path: fullPagePath,
    fullPage: true,
    type: "png",
  });
  screenshots.push({
    name: `${sessionId}-full.png`,
    path: fullPagePath,
    url: `/screenshots/${sessionId}-full.png`,
    section: "full",
    description: "Full page screenshot",
  });

  return screenshots;
}

/**
 * Try to capture UI/dashboard screenshots if there are demo links
 */
async function captureUIScreenshots(
  page: Page,
  sessionId: string,
  url: string
): Promise<ScreenshotData[]> {
  const screenshots: ScreenshotData[] = [];

  // Look for demo/app links
  const demoLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const demoPatterns = [
      /demo/i, /try/i, /app\./i, /dashboard/i, /login/i, /signup/i
    ];

    return links
      .filter(link => {
        const href = link.href || '';
        const text = link.textContent || '';
        return demoPatterns.some(p => p.test(href) || p.test(text));
      })
      .map(link => link.href)
      .filter(href => href && href.startsWith('http'))
      .slice(0, 2); // Limit to 2 demo links
  });

  console.log(`[Scraper] Found ${demoLinks.length} potential demo/app links`);

  // Try to capture one demo/app screenshot
  for (const demoLink of demoLinks) {
    try {
      // Only follow links on the same domain
      const baseHost = new URL(url).host;
      const linkHost = new URL(demoLink).host;

      if (linkHost.includes(baseHost) || baseHost.includes(linkHost)) {
        console.log(`[Scraper] Visiting demo link: ${demoLink}`);
        await page.goto(demoLink, { waitUntil: "networkidle2", timeout: 15000 });
        await waitForPageReady(page);

        const uiScreenshot = await takeScreenshot(page, sessionId, "ui", "App/Dashboard UI screenshot");
        screenshots.push(uiScreenshot);
        break;
      }
    } catch (error) {
      console.log(`[Scraper] Could not capture demo page: ${error}`);
    }
  }

  return screenshots;
}

/**
 * Wait for page to be visually ready (images loaded, spinners gone, content rendered)
 */
async function waitForPageReady(page: Page, timeoutMs: number = 10000): Promise<void> {
  const start = Date.now();

  // Wait for images in viewport to finish loading
  try {
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const images = Array.from(document.querySelectorAll('img'));
        const visibleImages = images.filter(img => {
          const rect = img.getBoundingClientRect();
          return rect.top < window.innerHeight && rect.bottom > 0;
        });

        if (visibleImages.length === 0) {
          resolve();
          return;
        }

        let loaded = 0;
        const total = visibleImages.length;
        const check = () => { loaded++; if (loaded >= total) resolve(); };

        visibleImages.forEach(img => {
          if (img.complete && img.naturalWidth > 0) {
            check();
          } else {
            img.addEventListener('load', check, { once: true });
            img.addEventListener('error', check, { once: true });
          }
        });

        // Safety timeout inside page context
        setTimeout(resolve, 8000);
      });
    });
  } catch {
    // Evaluate can fail on some pages, continue anyway
  }

  // Wait for common loading indicators to disappear
  const loadingSelectors = [
    '[class*="loading"]', '[class*="spinner"]', '[class*="skeleton"]',
    '[class*="placeholder"]', '[aria-busy="true"]',
  ];
  for (const selector of loadingSelectors) {
    try {
      await page.waitForSelector(selector, { hidden: true, timeout: 2000 });
    } catch {
      // Selector not found or already hidden, continue
    }
  }

  // Ensure minimum wait of 2s for JS rendering, animations settling
  const elapsed = Date.now() - start;
  const remaining = Math.max(0, 2000 - elapsed);
  if (remaining > 0) {
    await new Promise(r => setTimeout(r, remaining));
  }

  console.log(`[Scraper] Page ready after ${Date.now() - start}ms`);
}

async function scrapeWebsite(url: string): Promise<ScrapeResult> {
  const sessionId = `scrape-${Date.now()}`;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Set a reasonable user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    console.log(`[Scraper] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait for page to be visually ready (images loaded, spinners gone)
    await waitForPageReady(page);

    // Capture multiple screenshots for SaaS-style videos
    console.log("[Scraper] Capturing page screenshots...");
    const screenshots = await captureSaaSScreenshots(page, sessionId);

    // Try to capture UI/app screenshots
    const uiScreenshots = await captureUIScreenshots(page, sessionId, url);
    screenshots.push(...uiScreenshots);

    console.log(`[Scraper] Captured ${screenshots.length} screenshots total`);

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

      // Check for SaaS indicators
      const matchesText = (selector: string, text: string) =>
        Array.from(document.querySelectorAll(selector)).some(el => el.textContent?.toLowerCase().includes(text.toLowerCase()));
      const hasDemoButton = !!document.querySelector('a[href*="demo"]') || matchesText('button', 'Demo') || matchesText('a', 'Try');
      const hasPricing = !!document.querySelector('[class*="pricing"], [id*="pricing"]');
      const hasSignup = !!document.querySelector('a[href*="signup"], a[href*="register"]') || matchesText('button', 'Sign up');

      return {
        bodyText: bodyText.slice(0, 15000), // Limit text length
        images: ogImage ? [ogImage, ...images] : images,
        title,
        metaDesc,
        ogTitle,
        ogDesc,
        saasIndicators: { hasDemoButton, hasPricing, hasSignup },
      };
    });

    // Extract logos from the page
    const logos = await extractLogos(page, url);
    console.log(`[Scraper] Extracted ${logos.length} logos`);

    return {
      text: `Title: ${content.title}
Meta Description: ${content.metaDesc}
OG Title: ${content.ogTitle}
OG Description: ${content.ogDesc}

Page Content:
${content.bodyText}`,
      images: content.images,
      title: content.title,
      screenshots,
      logos,
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
    const { text, images, title, screenshots, logos } = await scrapeWebsite(state.sourceUrl);

    console.log(
      `[Scraper] Scraped ${text.length} chars, ${images.length} images, ${screenshots.length} screenshots, ${logos.length} logos`,
    );

    // Get hero screenshot for visual analysis
    const heroScreenshot = screenshots.find(s => s.section === "hero");
    let designAnalysis = {
      designInsights: "",
      colorPalette: [] as string[],
      layoutStyle: "centered",
      visualMood: "professional",
    };

    if (heroScreenshot) {
      designAnalysis = await analyzeScreenshotForDesign(heroScreenshot.path);
      console.log("[Scraper] Design insights:", designAnalysis.designInsights);
      console.log("[Scraper] Visual mood:", designAnalysis.visualMood);
    }

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
Determine if this is a SaaS product, ecommerce site, service, or other.
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

    const productData = JSON.parse(jsonMatch[0]) as ProductData & {
      productType?: string;
      screenshots?: ScreenshotData[];
      designInsights?: string;
      visualMood?: string;
    };

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

    // Store design insights and screenshots for video generation
    productData.designInsights = designAnalysis.designInsights;
    productData.visualMood = designAnalysis.visualMood;

    // Upload screenshots to R2 for reliable access during rendering
    if (isR2Configured()) {
      const projectId = `project-${Date.now()}`;
      console.log("[Scraper] Uploading screenshots to R2...");
      for (const screenshot of screenshots) {
        try {
          const result = await uploadScreenshotToR2(screenshot.path, projectId, screenshot.section);
          if (result.success && result.url) {
            screenshot.url = result.url; // Replace local URL with R2 public URL
            console.log(`[Scraper] Uploaded ${screenshot.section} to R2: ${result.url}`);
          }
        } catch (e) {
          console.warn(`[Scraper] Failed to upload ${screenshot.section} to R2, keeping local URL`);
        }
      }
    }

    productData.screenshots = screenshots;
    productData.logos = logos;

    // Log screenshot URLs for video usage
    console.log("[Scraper] Screenshots available for video:");
    for (const screenshot of screenshots) {
      console.log(`  - ${screenshot.section}: ${screenshot.url}`);
    }

    // Log logo URLs for video usage
    if (logos.length > 0) {
      console.log("[Scraper] Logos available for video:");
      for (const logo of logos) {
        console.log(`  - ${logo.source}: ${logo.url} (confidence: ${logo.confidence})`);
      }
    }

    console.log("[Scraper] Extracted product name:", productData.name);
    console.log("[Scraper] Extracted tagline:", productData.tagline);
    console.log("[Scraper] Product type:", productData.productType || "unknown");
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
