import { Router } from "express";
import { setupSSE, createSSESend } from "../lib/sse";
import { submitAndWaitForRender } from "../lib/render/renderClient";

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
        remotionCode,
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

export default router;
