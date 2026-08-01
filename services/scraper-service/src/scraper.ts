import puppeteer from "puppeteer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "my-assets";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || `https://pub-${R2_ACCOUNT_ID}.r2.dev`;
const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : "");

const r2Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  forcePathStyle: !!process.env.R2_FORCE_PATH_STYLE,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

export async function captureJitterScreenshot(opts: {
  url: string;
  id: string;
  width?: number;
  height?: number;
  settleMs?: number;
}): Promise<{ url: string; key: string; success: boolean }> {
  const { url, id, width = 1920, height = 1080, settleMs = 2000 } = opts;
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.PUPPETEER_CHROME_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    await new Promise((r) => setTimeout(r, settleMs));
    const buf = await page.screenshot({ type: "png", fullPage: false });
    const key = `screenshots/${id}.png`;
    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME, Key: key, Body: buf,
      ContentType: "image/png",
    }));
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    return { url: publicUrl, key, success: true };
  } finally {
    await browser.close();
  }
}
