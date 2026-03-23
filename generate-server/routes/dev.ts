import { Router } from "express";
import { setupSSE, createSSESend } from "../lib/sse";
import { submitAndWaitForRender } from "../lib/render/renderClient";
import { scraperNode } from "../lib/agents/scraper";
import { scriptWriterNode } from "../lib/agents/scriptWriter";
import { creativeDirectorNode } from "../lib/agents/creativeDirector";
import {
  remotionTranslatorNode,
  validateBeforeRender,
  enforceDuration,
} from "../lib/agents/remotionTranslator";
import { videoRendererNode } from "../lib/agents/videoRenderer";
import { renderErrorFixerNode } from "../lib/agents/renderErrorFixer";
import type { VideoGenerationStateType } from "../lib/agents/state";
import { generateBeatMap } from "../lib/audio/beatSync";
import {
  analyseBrand,
  inferBrandStyleFromText,
} from "../lib/agents/brandAnalyser";
import type { ScreenshotData } from "../lib/scraper/scraperClient";

const router: Router = Router();

// ============================================================
// DEV-ONLY: /dev/render — Test render endpoint (no auth, no credits)
// ============================================================

// GET /render — HTML playground
router.get("/render", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Remotion Render Playground</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; min-height: 100vh; }
    .container { max-width: 960px; margin: 0 auto; padding: 32px 24px; }
    h1 { font-size: 24px; font-weight: 600; margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 14px; margin-bottom: 24px; }
    .badge { display: inline-block; background: #7c3aed33; color: #a78bfa; font-size: 11px; padding: 2px 8px; border-radius: 9999px; border: 1px solid #7c3aed55; margin-left: 8px; vertical-align: middle; }
    label { display: block; font-size: 13px; color: #aaa; margin-bottom: 6px; font-weight: 500; }
    textarea { width: 100%; height: 400px; background: #141414; border: 1px solid #333; border-radius: 8px; color: #e5e5e5; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 13px; padding: 16px; resize: vertical; line-height: 1.5; }
    textarea:focus { outline: none; border-color: #7c3aed; }
    .row { display: flex; gap: 12px; margin: 16px 0; }
    .field { flex: 1; }
    input[type=number] { width: 100%; background: #141414; border: 1px solid #333; border-radius: 8px; color: #e5e5e5; font-size: 14px; padding: 10px 12px; }
    input[type=number]:focus { outline: none; border-color: #7c3aed; }
    select { width: 100%; background: #141414; border: 1px solid #333; border-radius: 8px; color: #e5e5e5; font-size: 14px; padding: 10px 12px; appearance: none; }
    button { background: #7c3aed; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; padding: 12px 28px; cursor: pointer; transition: background 0.15s; margin-top: 16px; }
    button:hover { background: #6d28d9; }
    button:disabled { background: #333; color: #666; cursor: not-allowed; }
    #log { margin-top: 24px; background: #141414; border: 1px solid #333; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 12px; max-height: 300px; overflow-y: auto; white-space: pre-wrap; line-height: 1.6; }
    .log-status { color: #60a5fa; }
    .log-error { color: #f87171; }
    .log-success { color: #4ade80; }
    .log-url { color: #fbbf24; }
    #result { margin-top: 20px; display: none; }
    #result video { width: 100%; max-width: 640px; border-radius: 8px; border: 1px solid #333; }
    #result a { display: inline-block; margin-top: 8px; color: #a78bfa; font-size: 13px; }
    .progress-bar { height: 4px; background: #222; border-radius: 2px; margin-top: 12px; overflow: hidden; }
    .progress-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #7c3aed, #a78bfa); transition: width 0.3s; border-radius: 2px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Remotion Render Playground <span class="badge">DEV</span></h1>
    <p class="subtitle">Paste Remotion TSX code and render it to video — no auth required.</p>

    <label for="code">Remotion TSX Code</label>
    <textarea id="code" placeholder="import React from 'react';&#10;import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';&#10;&#10;const MyVideo = () => {&#10;  const frame = useCurrentFrame();&#10;  const opacity = interpolate(frame, [0, 30], [0, 1]);&#10;  return (&#10;    <AbsoluteFill style={{ background: '#0a0a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&#10;      <h1 style={{ color: '#fbbf24', fontSize: 120, opacity }}>Hello World</h1>&#10;    </AbsoluteFill>&#10;  );&#10;};&#10;&#10;export default MyVideo;"></textarea>

    <div class="row">
      <div class="field">
        <label for="duration">Duration (frames, 30fps)</label>
        <input type="number" id="duration" value="150" min="30" max="1800" />
      </div>
      <div class="field">
        <label for="width">Width</label>
        <input type="number" id="width" value="1920" />
      </div>
      <div class="field">
        <label for="height">Height</label>
        <input type="number" id="height" value="1080" />
      </div>
      <div class="field">
        <label for="fps">FPS</label>
        <input type="number" id="fps" value="30" />
      </div>
      <div class="field">
        <label for="format">Format</label>
        <select id="format">
          <option value="mp4">MP4</option>
          <option value="webm">WebM</option>
        </select>
      </div>
    </div>

    <button id="renderBtn" onclick="doRender()">Render Video</button>

    <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
    <div id="log"></div>
    <div id="result">
      <video id="videoPlayer" controls></video>
      <br />
      <a id="downloadLink" href="#" download>Download video</a>
    </div>
  </div>

  <script>
    async function doRender() {
      const btn = document.getElementById('renderBtn');
      const log = document.getElementById('log');
      const result = document.getElementById('result');
      const progressFill = document.getElementById('progressFill');
      btn.disabled = true;
      btn.textContent = 'Rendering...';
      log.innerHTML = '';
      result.style.display = 'none';
      progressFill.style.width = '0%';

      const body = {
        remotionCode: document.getElementById('code').value,
        durationInFrames: parseInt(document.getElementById('duration').value) || 150,
        width: parseInt(document.getElementById('width').value) || 1920,
        height: parseInt(document.getElementById('height').value) || 1080,
        fps: parseInt(document.getElementById('fps').value) || 30,
        format: document.getElementById('format').value,
      };

      function appendLog(msg, cls) {
        log.innerHTML += '<span class="' + (cls || '') + '">' + msg + '\\n</span>';
        log.scrollTop = log.scrollHeight;
      }

      try {
        const res = await fetch('/dev/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              if (event.type === 'status') {
                const progress = event.data.progress || 0;
                progressFill.style.width = progress + '%';
                appendLog('[' + event.data.step + '] ' + event.data.message + (progress ? ' (' + progress + '%)' : ''), 'log-status');
              } else if (event.type === 'videoUrl') {
                appendLog('Video URL: ' + event.data, 'log-success');
                document.getElementById('videoPlayer').src = event.data;
                document.getElementById('downloadLink').href = event.data;
                result.style.display = 'block';
                progressFill.style.width = '100%';
              } else if (event.type === 'error') {
                appendLog('Error: ' + JSON.stringify(event.data), 'log-error');
              } else if (event.type === 'complete') {
                appendLog(event.data.success ? 'Done!' : 'Completed with errors', event.data.success ? 'log-success' : 'log-error');
              }
            } catch (e) { appendLog(line, ''); }
          }
        }
      } catch (err) {
        appendLog('Network error: ' + err.message, 'log-error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Render Video';
      }
    }
  </script>
</body>
</html>`);
});

// POST /render — Render remotion code (SSE progress)
router.post("/render", async (req, res) => {
  console.log("[DevRender] POST /dev/render — test render");

  const {
    remotionCode,
    durationInFrames = 150,
    fps = 30,
    width = 1920,
    height = 1080,
    format = "mp4",
  } = req.body;

  if (!remotionCode) {
    return res.status(400).json({ error: "remotionCode is required" });
  }

  // Auto-fix common LLM syntax issues before rendering
  const analysis = validateBeforeRender(remotionCode);
  const fixedCode = analysis.autoFixed;
  if (analysis.errors.length > 0 || analysis.warnings.length > 0) {
    console.log(`[DevRender] Auto-fixed: ${analysis.errors.length} errors, ${analysis.warnings.length} warnings`);
  }

  setupSSE(res);
  const send = createSSESend(res);

  try {
    send("status", {
      step: "rendering",
      message: "Starting render via render-service...",
      progress: 5,
    });

    const status = await submitAndWaitForRender(
      {
        remotionCode: fixedCode,
        durationInFrames,
        outputFormat: format as "mp4" | "webm",
        width,
        height,
        fps,
      },
      (progress) => {
        if (progress.progress !== undefined) {
          send("status", {
            step: "rendering",
            message: `Rendering... ${Math.round((progress.progress || 0) * 100)}%`,
            progress: 5 + Math.round((progress.progress || 0) * 90),
          });
        }
      },
    );

    if (status.status === "completed" && status.videoUrl) {
      send("videoUrl", status.videoUrl);
      send("status", {
        step: "complete",
        message: `Rendered in ${status.renderTime}ms`,
        progress: 100,
      });
      send("complete", { success: true, renderTime: status.renderTime });
    } else {
      send("error", { errors: [status.error || "Render failed"] });
      send("complete", { success: false });
    }
  } catch (error) {
    console.error("[DevRender] Error:", error);
    send("error", {
      errors: [error instanceof Error ? error.message : "Unknown error"],
    });
    send("complete", { success: false });
  } finally {
    res.end();
  }
});

// ============================================================
// POST /generate — Full pipeline: scrape → brand → script → code → render (no auth)
// ============================================================
router.post("/generate", async (req, res) => {
  console.log("[DevGenerate] POST /dev/generate — full pipeline test");

  const {
    url,
    description,
    style = "professional",
    videoType = "creative",
    duration = 10,
    aspectRatio = "16:9",
    audio,
  } = req.body;

  if (!url && !description) {
    return res.status(400).json({ error: "Either url or description is required" });
  }

  setupSSE(res);
  const send = createSSESend(res);

  try {
    const audioBpm = audio?.bpm || 120;
    const videoDurationSec = typeof duration === "string" ? parseInt(duration) : duration;
    const totalFrames = videoDurationSec * 30;

    let state: Partial<VideoGenerationStateType> = {
      sourceUrl: url || null,
      description: description || null,
      userPreferences: {
        style: style as any,
        videoType: videoType as any,
        duration: videoDurationSec,
        aspectRatio: aspectRatio || "16:9",
        useImages: false,
        audio: audio ? { url: audio.url, bpm: audioBpm, duration: audio.duration || videoDurationSec } : undefined,
      } as any,
      recordings: [],
      productData: null,
      videoScript: null,
      reactPageCode: null,
      remotionCode: null,
      currentStep: "scraping",
      errors: [],
      renderAttempts: 0,
      lastRenderError: null,
      videoUrl: null,
      beatMap: generateBeatMap({ bpm: audioBpm, totalDurationFrames: totalFrames, fps: 30 }),
      r2Key: null,
      projectId: null,
    };

    // Step 1: Scrape
    send("status", { step: "scraping", message: `Scraping ${url || "description"}...` });
    const scraperResult = await scraperNode(state as VideoGenerationStateType);
    state = { ...state, ...scraperResult };

    if (state.currentStep === "error") {
      send("error", { errors: state.errors });
      send("complete", { success: false });
      return res.end();
    }
    send("status", { step: "scraping", message: `Scraped: ${state.productData?.name}` });

    // Step 1.5: Brand analysis (vision if screenshots available, text fallback)
    if (state.productData) {
      try {
        const screenshots = (state.productData as any)?.screenshots || [];
        const heroScreenshot = screenshots.find((s: any) => s.section === "hero") || screenshots[0];
        let brandStyle;
        if (heroScreenshot) {
          brandStyle = await analyseBrand(
            heroScreenshot as ScreenshotData,
            state.productData.name || "Product",
            state.productData.description,
          );
          send("status", { step: "brand", message: `Brand analyzed (vision): ${brandStyle?.videoStyle?.recommended || "done"}` });
        }
        if (!brandStyle) {
          brandStyle = await inferBrandStyleFromText(
            state.productData.name || "Product",
            state.productData.description || "",
            state.productData.tone || "professional",
            state.productData.colors || {},
          );
          send("status", { step: "brand", message: `Brand inferred: ${brandStyle?.videoStyle?.recommended || "done"}` });
        }
        (state.productData as any).brandStyle = brandStyle;
        (state.productData as any).designInsights = brandStyle.designInsights;
        (state.productData as any).visualMood = brandStyle.mood?.tone;
        console.log(`[DevGenerate] Brand: ${brandStyle.videoStyle?.recommended}, colors: ${brandStyle.colors?.primary}/${brandStyle.colors?.secondary}`);
      } catch (e) {
        console.warn("[DevGenerate] Brand analysis failed (non-fatal):", e);
      }
    }

    // Step 2: Script
    send("status", { step: "scripting", message: "Writing video script..." });
    const scriptResult = await scriptWriterNode(state as VideoGenerationStateType);
    state = { ...state, ...scriptResult };
    if (state.videoScript) {
      send("videoScript", state.videoScript);
    }

    // Step 2.5: Creative Director
    send("status", { step: "directing", message: "Adding creative direction..." });
    const dirResult = await creativeDirectorNode(state as VideoGenerationStateType);
    state = { ...state, ...dirResult };

    // Step 3: Remotion Translator
    send("status", { step: "translating", message: "Generating Remotion code..." });
    const translatorResult = await remotionTranslatorNode(state as VideoGenerationStateType);
    state = { ...state, ...translatorResult };

    if (state.remotionCode) {
      send("remotionCode", state.remotionCode);
      // Pre-render validation
      const analysis = validateBeforeRender(state.remotionCode as string);
      if (analysis.errors.length > 0 || analysis.warnings.length > 0) {
        state.remotionCode = analysis.autoFixed;
      }
      const targetFrames = state.videoScript?.totalDuration || totalFrames;
      state.remotionCode = enforceDuration(state.remotionCode as string, targetFrames);
    }

    if (state.currentStep === "error") {
      send("error", { errors: state.errors });
      send("complete", { success: false });
      return res.end();
    }

    // Step 4: Render with retry
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      state.renderAttempts = attempts;
      send("status", { step: "rendering", message: `Rendering video (attempt ${attempts})...` });

      const renderResult = await videoRendererNode(state as VideoGenerationStateType);
      state = { ...state, ...renderResult };

      if (state.videoUrl) {
        send("videoUrl", state.videoUrl);
        send("status", { step: "complete", message: "Video rendered!" });
        break;
      }

      if (state.currentStep === "fixing" && attempts < maxAttempts) {
        send("status", { step: "fixing", message: `Fixing render errors (attempt ${attempts})...` });
        const fixResult = await renderErrorFixerNode(state as VideoGenerationStateType);
        state = { ...state, ...fixResult };
        if (fixResult.remotionCode) {
          send("remotionCode", fixResult.remotionCode);
        }
      } else if (state.currentStep === "error") {
        send("error", { errors: state.errors });
        break;
      }
    }

    if (state.videoUrl) {
      send("complete", { success: true, message: "Video generation complete" });
    } else {
      send("error", { errors: state.errors?.length ? state.errors : ["Rendering failed"] });
      send("complete", { success: false });
    }
  } catch (error) {
    console.error("[DevGenerate] Error:", error);
    send("error", { errors: [error instanceof Error ? error.message : "Unknown error"] });
    send("complete", { success: false });
  } finally {
    res.end();
  }
});

export default router;
