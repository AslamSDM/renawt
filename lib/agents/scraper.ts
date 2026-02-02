import puppeteer from "puppeteer";
import { scraperModel } from "./model";
import type { ProductData } from "../types";
import type { VideoGenerationStateType } from "./state";

const model = scraperModel();

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
}> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

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

export async function scraperNode(
  state: VideoGenerationStateType
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
    const { text, images, title } = await scrapeWebsite(state.sourceUrl);

    console.log(`[Scraper] Scraped ${text.length} chars, ${images.length} images`);

    // Use Claude to extract structured product data
    const response = await model.invoke([
      { role: "system", content: SCRAPER_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Analyze this website and extract product information:

URL: ${state.sourceUrl}
Page Title: ${title}

${state.description ? `Additional context from user: ${state.description}\n\n` : ""}

Page Content:
${text}

Found Images:
${images.join("\n")}

Return ONLY valid JSON.`,
      },
    ]);

    const rawContent = response.content;
    const responseText: string =
      typeof rawContent === "string"
        ? rawContent
        : Array.isArray(rawContent) && rawContent[0]?.type === "text"
          ? (rawContent[0] as { type: "text"; text: string }).text
          : "";

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from response");
    }

    const productData = JSON.parse(jsonMatch[0]) as ProductData;

    // Merge scraped images if they weren't in the response
    if (productData.images.length === 0 && images.length > 0) {
      productData.images = images.slice(0, 5);
    }

    console.log(`[Scraper] Extracted product: ${productData.name}`);

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
