import puppeteer, { Page } from "puppeteer";
import type { ScreenshotData, ScrapeResult } from "./types.js";
import { uploadScreenshotBufferToR2, isR2Configured } from "./r2Upload.js";

async function takeScreenshot(
  page: Page,
  sessionId: string,
  section: ScreenshotData["section"],
  description: string
): Promise<ScreenshotData> {
  const filename = `${sessionId}-${section}-${Date.now()}.png`;

  const buffer = await page.screenshot({
    fullPage: false,
    type: "png",
  });

  // Upload to R2 directly
  if (isR2Configured()) {
    const result = await uploadScreenshotBufferToR2(Buffer.from(buffer), filename, section);
    if (result.success && result.url) {
      console.log(`[Scraper] Screenshot uploaded to R2: ${section} - ${result.url}`);
      return {
        name: filename,
        path: "",
        url: result.url,
        section,
        description,
      };
    }
    console.warn(`[Scraper] R2 upload failed for ${section}, screenshot discarded`);
  } else {
    console.warn(`[Scraper] R2 not configured, screenshot discarded: ${section}`);
  }

  return {
    name: filename,
    path: "",
    url: "",
    section,
    description,
  };
}

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
      await new Promise((r) => setTimeout(r, 1500));
      return await takeScreenshot(page, sessionId, section, description);
    }
  } catch (error) {
    console.log(`[Scraper] Could not capture ${section}: ${error}`);
  }
  return null;
}

async function captureSaaSScreenshots(
  page: Page,
  sessionId: string
): Promise<ScreenshotData[]> {
  const screenshots: ScreenshotData[] = [];

  // 1. Hero section
  console.log("[Scraper] Capturing hero section...");
  screenshots.push(
    await takeScreenshot(page, sessionId, "hero", "Hero section - main headline and CTA")
  );

  // 2. Features section
  console.log("[Scraper] Looking for features section...");
  const featureSelectors = [
    '[class*="feature"]',
    '[id*="feature"]',
    '[class*="benefit"]',
    '[class*="solution"]',
    "section:nth-of-type(2)",
    "#features",
  ];

  for (const selector of featureSelectors) {
    const screenshot = await scrollAndCapture(
      page, sessionId, selector, "features", "Features section - key product capabilities"
    );
    if (screenshot) {
      screenshots.push(screenshot);
      break;
    }
  }

  // 3. Pricing section
  console.log("[Scraper] Looking for pricing section...");
  const pricingSelectors = [
    '[class*="pricing"]', '[id*="pricing"]', '[class*="plans"]', "#pricing",
  ];

  for (const selector of pricingSelectors) {
    const screenshot = await scrollAndCapture(
      page, sessionId, selector, "pricing", "Pricing section - plans and costs"
    );
    if (screenshot) {
      screenshots.push(screenshot);
      break;
    }
  }

  // 4. Testimonials section
  console.log("[Scraper] Looking for testimonials section...");
  const testimonialSelectors = [
    '[class*="testimonial"]', '[class*="review"]', '[class*="customer"]',
    '[id*="testimonial"]', "#testimonials",
  ];

  for (const selector of testimonialSelectors) {
    const screenshot = await scrollAndCapture(
      page, sessionId, selector, "testimonials", "Testimonials - social proof"
    );
    if (screenshot) {
      screenshots.push(screenshot);
      break;
    }
  }

  // 5. Full page screenshot
  console.log("[Scraper] Capturing full page...");
  const fullPageFilename = `${sessionId}-full.png`;
  const fullPageBuffer = await page.screenshot({
    fullPage: true,
    type: "png",
  });

  if (isR2Configured()) {
    const fullResult = await uploadScreenshotBufferToR2(Buffer.from(fullPageBuffer), fullPageFilename, "full");
    if (fullResult.success && fullResult.url) {
      screenshots.push({
        name: fullPageFilename,
        path: "",
        url: fullResult.url,
        section: "full",
        description: "Full page screenshot",
      });
    }
  }

  return screenshots;
}

async function captureUIScreenshots(
  page: Page,
  sessionId: string,
  url: string
): Promise<ScreenshotData[]> {
  const screenshots: ScreenshotData[] = [];

  const demoLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a"));
    const demoPatterns = [/demo/i, /try/i, /app\./i, /dashboard/i, /login/i, /signup/i];

    return links
      .filter((link) => {
        const href = link.href || "";
        const text = link.textContent || "";
        return demoPatterns.some((p) => p.test(href) || p.test(text));
      })
      .map((link) => link.href)
      .filter((href) => href && href.startsWith("http"))
      .slice(0, 2);
  });

  console.log(`[Scraper] Found ${demoLinks.length} potential demo/app links`);

  for (const demoLink of demoLinks) {
    try {
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

async function waitForPageReady(page: Page, timeoutMs: number = 10000): Promise<void> {
  const start = Date.now();

  try {
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const images = Array.from(document.querySelectorAll("img"));
        const visibleImages = images.filter((img) => {
          const rect = img.getBoundingClientRect();
          return rect.top < window.innerHeight && rect.bottom > 0;
        });

        if (visibleImages.length === 0) {
          resolve();
          return;
        }

        let loaded = 0;
        const total = visibleImages.length;
        const check = () => {
          loaded++;
          if (loaded >= total) resolve();
        };

        visibleImages.forEach((img) => {
          if (img.complete && img.naturalWidth > 0) {
            check();
          } else {
            img.addEventListener("load", check, { once: true });
            img.addEventListener("error", check, { once: true });
          }
        });

        setTimeout(resolve, 8000);
      });
    });
  } catch {
    // Continue on evaluation errors
  }

  const loadingSelectors = [
    '[class*="loading"]', '[class*="spinner"]', '[class*="skeleton"]',
    '[class*="placeholder"]', '[aria-busy="true"]',
  ];
  for (const selector of loadingSelectors) {
    try {
      await page.waitForSelector(selector, { hidden: true, timeout: 2000 });
    } catch {
      // Selector not found or already hidden
    }
  }

  const elapsed = Date.now() - start;
  const remaining = Math.max(0, 2000 - elapsed);
  if (remaining > 0) {
    await new Promise((r) => setTimeout(r, remaining));
  }

  console.log(`[Scraper] Page ready after ${Date.now() - start}ms`);
}

export async function scrapeWebsite(url: string): Promise<ScrapeResult> {
  const sessionId = `scrape-${Date.now()}`;
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );

    // Dismiss cookie banners and popups after page loads
    page.on("load", async () => {
      try {
        await page.evaluate(() => {
          const dismissSelectors = [
            '[class*="cookie"] button',
            '[id*="cookie"] button',
            '[class*="consent"] button',
            '[class*="banner"] button[class*="accept"]',
            '[class*="banner"] button[class*="close"]',
            '[class*="modal"] button[class*="close"]',
            '[class*="popup"] button[class*="close"]',
            '[aria-label="Close"]',
            '[aria-label="Accept"]',
            'button[class*="dismiss"]',
          ];
          for (const sel of dismissSelectors) {
            const btn = document.querySelector<HTMLElement>(sel);
            if (btn) { btn.click(); break; }
          }
        });
      } catch {}
    });

    // Collect console errors during page load
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    console.log(`[Scraper] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await waitForPageReady(page);

    // Detect client-side error pages (Next.js, React, Vercel, etc.)
    const errorState = await page.evaluate(() => {
      const body = document.body;
      if (!body) return { isError: true, reason: "No body element" };

      const text = body.innerText.trim().toLowerCase();
      const errorPatterns = [
        "application error",
        "this page could not be found",
        "500 internal server error",
        "something went wrong",
        "an unexpected error has occurred",
        "this page isn't working",
        "page not found",
        "404",
        "unhandled runtime error",
      ];
      const matchedError = errorPatterns.find((p) => text.includes(p));
      if (matchedError && text.length < 500) {
        return { isError: true, reason: matchedError };
      }

      // Detect mostly empty/black pages (body has almost no visible content)
      const visibleElements = document.querySelectorAll(
        "h1, h2, h3, p, img, button, a, input, [role='main']"
      );
      if (visibleElements.length < 2 && text.length < 100) {
        return { isError: true, reason: "Page appears empty or failed to render" };
      }

      return { isError: false, reason: "" };
    });

    if (errorState.isError) {
      console.warn(`[Scraper] Error page detected: ${errorState.reason}`);
      // Try a reload — some SPAs recover on retry
      console.log("[Scraper] Retrying with full page reload...");
      await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
      await waitForPageReady(page, 15000);

      // Check again
      const retryCheck = await page.evaluate(() => {
        const text = document.body?.innerText?.trim().toLowerCase() || "";
        const elements = document.querySelectorAll("h1, h2, h3, p, img, button");
        return text.length < 100 && elements.length < 2;
      });

      if (retryCheck) {
        console.error("[Scraper] Page still broken after reload");
        if (pageErrors.length > 0) {
          console.error(`[Scraper] JS errors: ${pageErrors.slice(0, 3).join("; ")}`);
        }
      }
    }

    // Capture screenshots
    console.log("[Scraper] Capturing page screenshots...");
    const screenshots = await captureSaaSScreenshots(page, sessionId);
    const uiScreenshots = await captureUIScreenshots(page, sessionId, url);
    screenshots.push(...uiScreenshots);

    console.log(`[Scraper] Captured ${screenshots.length} screenshots total`);

    // Extract page content
    const content = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const images = Array.from(document.querySelectorAll("img"))
        .map((img) => img.src)
        .filter((src) => src && src.startsWith("http"))
        .slice(0, 10);
      const title = document.title;
      const metaDesc =
        document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
      const ogTitle =
        document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
      const ogDesc =
        document.querySelector('meta[property="og:description"]')?.getAttribute("content") || "";
      const ogImage =
        document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";

      const matchesText = (selector: string, text: string) =>
        Array.from(document.querySelectorAll(selector)).some((el) =>
          el.textContent?.toLowerCase().includes(text.toLowerCase())
        );
      const hasDemoButton =
        !!document.querySelector('a[href*="demo"]') ||
        matchesText("button", "Demo") ||
        matchesText("a", "Try");
      const hasPricing = !!document.querySelector('[class*="pricing"], [id*="pricing"]');
      const hasSignup =
        !!document.querySelector('a[href*="signup"], a[href*="register"]') ||
        matchesText("button", "Sign up");

      return {
        bodyText: bodyText.slice(0, 15000),
        images: ogImage ? [ogImage, ...images] : images,
        title,
        metaDesc,
        ogTitle,
        ogDesc,
        saasIndicators: { hasDemoButton, hasPricing, hasSignup },
      };
    });

    // Filter out screenshots that failed to upload (empty URLs)
    const uploadedScreenshots = screenshots.filter((s) => s.url);

    return {
      text: `Title: ${content.title}
Meta Description: ${content.metaDesc}
OG Title: ${content.ogTitle}
OG Description: ${content.ogDesc}

Page Content:
${content.bodyText}`,
      images: content.images,
      title: content.title,
      screenshots: uploadedScreenshots,
      saasIndicators: content.saasIndicators,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Simple screenshot capture (backward compatible with screenshot-api)
 */
export async function captureScreenshot(url: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const image = await page.screenshot({
      fullPage: true,
      type: "png",
    });

    return Buffer.from(image);
  } finally {
    await browser.close();
  }
}
