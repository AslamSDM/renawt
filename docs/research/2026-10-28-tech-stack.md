# Technology Landscape: Faceless Short-Form Video Platform (as of 2026-10-28)

Scope: agent framework (Mastra), LLMs (Claude, DeepSeek), TTS, captions, visuals, music, rendering (HyperFrames), orchestration, and per-video COGS. The stack we keep: Next.js 16 on Vercel, Prisma + Neon, R2, Dodo credits, the Express `generate-server` on ECS, HyperFrames on Lambda via SQS, and ElevenLabs.

Method: official docs and pricing pages fetched on 2026-10-28, plus npm registry metadata. Where only third-party sources exist, the figure is marked **(secondary)**. Where I could not verify a figure, it is marked **(unverified)**. Prices are list USD.

Note: the local `node_modules/@mastra/core` and `node_modules/ai` do not exist in this repo checkout, so all Mastra and AI SDK facts below come from npm and the docs.

---

## 1. Mastra

### 1.1 Version and release cadence
- `@mastra/core` **1.79.0**, published 2026-10-21. 1.0.0 shipped 2026-01-20 ([npm registry](https://registry.npmjs.org/@mastra/core)). That is ~79 minor releases in 9 months. In Sep–Oct 2026 a minor shipped every 2–7 days (1.65.0 on 09-09 through 1.79.0 on 10-21). **Pin exact versions and upgrade on purpose.**
- 1.0 brought per-domain storage, a reworked processor system and AI SDK v6 support ([changelog 2026-01-20](https://mastra.ai/blog/changelog-2026-01-20)).
- Related packages are current: `@mastra/pg` 1.32.0, `@mastra/inngest` 1.10.7, `@mastra/next` 0.2.37 (all 2026-10-21, npm).
- **AI SDK compatibility:** `@mastra/core` 1.79 depends on aliased `@ai-sdk/provider-v5`, `-v6` and `-v7` packages and has a zod peer of `^3.25 || ^4` ([npm](https://registry.npmjs.org/@mastra/core/latest)). The current `ai` package is **7.0.155** ([npm](https://registry.npmjs.org/ai/latest)). The Next.js guide calls `handleChatStream({ version: 'v7' })` ([Next.js integration](https://mastra.ai/integrations/frameworks/next-js)). Mastra therefore accepts v5, v6 and v7 provider models and emits v7 UI streams. `withMastra()` wraps any AI SDK model ([AI SDK ref](https://mastra.ai/reference/ai-sdk/overview.md)).

### 1.2 Architecture
| Area | What exists (docs) |
|---|---|
| **Agents** | `new Agent({id, name, instructions, model, tools})`. Tools come from `createTool()` with zod input/output schemas. Agents also support structured output, guardrails, processors, human-in-the-loop and skills ([docs index](https://mastra.ai/llms.txt), [get started](https://mastra.ai/docs)). |
| **Model routing** | `"provider/model"` strings, with keys read from env (`ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`). Examples: `anthropic/claude-sonnet-5-5`, `anthropic/claude-opus-5-5` ([models](https://mastra.ai/models)), `deepseek/deepseek-flash`, `deepseek/deepseek-v4-pro` ([DeepSeek provider](https://mastra.ai/models/providers/deepseek)). Fallback is an array `[{model, maxRetries}]`, tried in order on 5xx, rate-limit or timeout. Gateways: OpenRouter, plus custom `gateway/provider/model`. |
| **Structured output** | Zod, Valibot, ArkType or any Standard JSON Schema ([workflows overview](https://mastra.ai/docs/workflows/overview.md)). See [structured-output](https://mastra.ai/docs/agents/structured-output.md). |
| **Streaming** | `agent.stream()`, `streamUntilIdle`, and workflow `stream()`/`resumeStream()`/`observeStream()`. Step `writer` can pipe agent streams. |
| **Workflows** | `createStep`/`createWorkflow` with `.then/.parallel/.branch/.foreach/.dowhile/.dountil/.map/.sleep/.sleepUntil`, nested workflows, `stateSchema`, snapshots, time-travel, `restart()` ([reference list](https://mastra.ai/llms.txt)). Results are a union: `success/failed/suspended/tripwire/paused`. |
| **Suspend/resume** | The snapshot is persisted to storage. `run.resume({step, resumeData})` continues it ([suspend & resume](https://mastra.ai/docs/workflows/suspend-and-resume)). This is the right fit for "wait for the Lambda render callback" and "wait for user approval". |
| **Durability (built-in engine)** | Active runs restart on boot (`restartAllActiveWorkflowRuns`, concurrency 5 by default). Runs hold a renewing storage lease, but the lease is **advisory and does not fence writes**. A stalled process can run a step twice, so steps must be idempotent ([workflows overview](https://mastra.ai/docs/workflows/overview.md)). |
| **Workflow runners** | Built-in, **Inngest** (memoization, retries, suspend/resume, flow control), and **Temporal** (`@mastra/temporal`, marked "experimental and not ready for production"). The page does not mention Vercel Workflow or Trigger.dev ([workflow runners](https://mastra.ai/docs/deployment/workflow-runners.md)). |
| **Scheduling** | A `schedule: {cron, timezone, inputData}` on `createWorkflow`. The built-in scheduler is an in-process `setInterval` poller and **does not fire on serverless** (Vercel/Lambda). On a long-lived host (ECS) you must call `mastra.startWorkers()` when using a server adapter. Delivery is best-effort (3 attempts, missed ticks not replayed). On serverless, use `@mastra/inngest` cron ([scheduled workflows](https://mastra.ai/docs/workflows/scheduled-workflows.md)). |
| **Memory** | Message history, Observational Memory (recommended: background compression), working memory (structured per-resource facts, good for brand voice and preferences), semantic recall and multi-user threads. Scoped by `resource` + `thread`. Subagents get `{parentResourceId}-{agentName}` ([memory](https://mastra.ai/docs/memory/overview.md)). |
| **Storage** | ~20 adapters, including PostgreSQL and Neon. The default is in-memory. `MastraCompositeStore` routes domains (workflows, observability, …) to different backends. Tables are created "on first use" ([storage](https://mastra.ai/docs/storage.md)). |
| **RAG** | Chunk/embed/rerank, GraphRAG, metadata filters, and vector stores including **pgvector** (`@mastra/pg`), Vectorize and S3 Vectors ([RAG refs](https://mastra.ai/llms.txt)). |
| **Evals/Scorers** | `createScorer`, built-ins (faithfulness, tone-consistency, prompt-alignment, rubric, toxicity, tool-call accuracy…), datasets/experiments, CI and Vitest integration ([evals](https://mastra.ai/docs/evals/overview.md)). |
| **Observability** | Tracing/metrics/logging, with exporters for Langfuse, LangSmith, Braintrust, Datadog, Sentry, **PostHog**, OTel and others. On serverless you must `await mastra.observability.flush()` ([Vercel deploy](https://mastra.ai/integrations/deploy/vercel.md)). |
| **MCP** | MCP client and MCP server, plus A2A/ACP ([MCP](https://mastra.ai/docs/connections/mcp.md)). The HyperFrames hosted MCP is in the official MCP registry ([HF changelog](https://hyperframes.heygen.com/changelog.md)). |
| **Multi-agent** | Supervisor agents with `agents: {...}` subagents, delegation hooks and memory isolation. Handoffs and councils are composed from workflows. `agent.network()` has migration guides to supervisor ([multi-agent guide](https://mastra.ai/docs/guides/multi-agent-systems.md), [network→supervisor](https://mastra.ai/reference/migrations/network-to-supervisor.md)). |
| **DurableAgent** | Resumable agent streams over PubSub (Redis Streams for multi-process), backed by evented or Inngest engines. **Beta: breaking changes possible without a major bump** ([durable agent](https://mastra.ai/reference/agents/durable-agent.md)). |
| **Deployment** | Mastra Server (`mastra build`, Hono-based), server adapters (Express, Fastify, Hono, Next, Nest…), Vercel/Netlify/Cloudflare deployers, AWS Lambda, EC2, Kubernetes and Mastra platform ([deployment](https://mastra.ai/llms.txt)). Next.js uses `createNextRouteHandler` from `@mastra/next` on a catch-all route and needs Node ≥22.13 ([Next.js](https://mastra.ai/integrations/frameworks/next-js)). |

### 1.3 Recommended Mastra architecture for us
1. **Mastra lives in the ECS `generate-server`.** Mount it with the Express server adapter. ECS is a long-lived host, which is what the scheduler, restart-on-boot and evented engine assume.
2. **Workflows run on `@mastra/inngest`.** Serve them from the Express app with `createServe`, or use `connect()` (beta, long-running workers only) ([Inngest deploy](https://mastra.ai/integrations/deploy/inngest.md)). This adds per-step memoization, plus per-user `concurrency`, `rateLimit` and `throttle` for vendor quotas (ElevenLabs, Veo), and durable cron for the publishing scheduler.
3. **Pipeline workflow:** `ideate → script → (parallel) tts+timestamps | visualPlan → assets (foreach: image/video/stock) → htmlCompose → lint/critic loop (dountil) → render (enqueue SQS; suspend) → [Lambda callback resumes] → qc → publish/schedule (sleepUntil)`.
4. **Vercel side stays thin.** Next.js route handlers start runs, poll status and stream progress through `@mastra/client-js` or a proxy. Do not bundle Mastra into Vercel functions for the pipeline.
5. **Storage:** `@mastra/pg` `PostgresStore` on Neon in its **own Postgres schema** or a separate Neon database. Add `PgVector` only if we need RAG over the template library or past high performers.

### 1.4 Gotchas
- **Prisma coexistence:** Mastra auto-creates its tables at first use ([storage](https://mastra.ai/docs/storage.md)). If they land in `public`, `prisma migrate dev` will see drift and offer a reset. Isolate them in a separate schema (check `PostgresStore`'s schema option in the [pg reference](https://mastra.ai/reference/vectors/pg.md)) or a separate Neon DB, and keep Prisma's `schemas` list to its own. Use the Neon pooled URL for Mastra at runtime. The doc page does not address ORM coexistence **(inference)**.
- **Vercel:** the filesystem is ephemeral, so no file-based libSQL. Telemetry must be flushed. Workflow scheduling does not fire. Total bundle limit is 250 MB ([Vercel Workflow limits](https://vercel.com/docs/workflows/pricing)). All of this argues against hosting Mastra there.
- **Idempotency:** both the built-in lease (advisory) and Inngest retries can re-run steps. Key every TTS, image and video call by `(videoId, stepId, attempt-hash)` and check R2 before you pay again.
- **Churn:** DurableAgent is beta and Temporal is experimental. The release cadence is roughly weekly.

---

## 2. Claude (Anthropic)

The lineup was verified against the [models overview](https://platform.claude.com/docs/en/about-claude/models/overview) and [pricing](https://platform.claude.com/docs/en/about-claude/pricing). The Claude 5 family exists as named: **Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 5.5**.

| Model (API id) | Input $/MTok | Output $/MTok | 5m cache write | 1h cache write | Cache hit | Batch in/out | Context / max out | Latency |
|---|---|---|---|---|---|---|---|---|
| Fable 5.1 (`claude-fable-5-1`) | 10 | 50 | 12.50 | 20 | 0.25 | 5 / 25 | 1M / 128K | Slower |
| Opus 5.5 (`claude-opus-5-5`) | 4 | 20 | 5 | 8 | 0.20 | 2 / 10 | 1M / 128K | Moderate |
| Sonnet 5.5 (`claude-sonnet-5-5`) | 2 | 10 | 2.50 | 4 | 0.10 | 1 / 5 | 1M / 128K | Fast |
| Haiku 5.5 (`claude-haiku-5-5`) ≤100K prompt | 0.10 | 0.50 | 0.125 | 0.20 | 0.01 | 0.05 / 0.25 | 1M / 128K | Fastest |
| Haiku 5.5 >100K prompt | 0.50 | 2.50 | 0.625 | 1 | 0.05 | 0.25 / 1.25 | — | — |

- **Caching:** hits cost 5% of base input on Opus and Sonnet 5.5, 2.5% on Fable 5.1, and 10% on others. 5m writes cost 1.25x and 1h writes 2x. Caching stacks with batch. Long context is billed at the standard rate up to 1M, except Haiku 5.5 ([pricing](https://platform.claude.com/docs/en/about-claude/pricing)).
- **Other modifiers:** Batch API is −50%. US-only inference (`inference_geo`) is 1.1x. Opus 5.5 fast mode is $8/$40. Web search is $10 per 1K searches ([pricing](https://platform.claude.com/docs/en/about-claude/pricing)).
- **Capabilities:** all current models take text and image input and support vision and tool use. Thinking is adaptive (always on for Opus and Fable). Default effort is `medium` on Opus and Haiku and `high` on Sonnet and Fable ([overview](https://platform.claude.com/docs/en/about-claude/models/overview)).
- **Structured outputs are GA:** `output_config.format: {type:"json_schema"}` plus `strict: true` on tools, with TS `zodOutputFormat()` ([structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)). Limits: no recursive schemas, no min/max or length constraints, `additionalProperties:false` required, and at most 20 strict tools / 24 optional params / 16 union params per request. Our scene schema must be flat-ish, with constraints validated locally in zod.

**Job mapping:**
| Job | Model | Why |
|---|---|---|
| Trend tagging, niche classification, moderation, hashtag/title variants, caption line-breaking | **Haiku 5.5** | $0.10/$0.50, built for classification and routing |
| Script (hook/body/CTA) | **Sonnet 5.5** (default), Opus 5.5 (premium) | Voice adherence; output is short (~1–2K tokens) |
| Visual plan + HyperFrames HTML/GSAP generation | **Sonnet 5.5**, with Opus 5.5 for premium or retry-on-lint-failure | Long code output dominates cost; cache the HyperFrames skill/system prompt (1h cache) |
| Critic (vision on rendered keyframes + lint report) | **Opus 5.5** for premium, Sonnet for standard | Vision is supported on all models |
| Overnight bulk for scheduled queue | Any of the above via **Batch API (−50%)** | Scheduling platform, so most jobs are not latency-bound |
| Fable 5.1 | Not needed per video; maybe one-off brand-kit / design-system synthesis | 2.5x Opus price |

---

## 3. DeepSeek API

From [pricing](https://api-docs.deepseek.com/quick_start/pricing) and [rate limits](https://api-docs.deepseek.com/quick_start/rate_limit):

| | `deepseek-flash` (V4.1-Flash-1017) | `deepseek-v4-pro` (V4-Pro-0813) |
|---|---|---|
| Context / max output | 1M / 384K | 1M / 384K |
| Input cache-hit (peak / off-peak) | $0.006 / $0.003 | $0.044 / $0.022 |
| Input cache-miss (peak / off-peak) | $0.30 / $0.15 | $1.32 / $0.66 |
| Output (peak / off-peak) | $1.20 / $0.60 | $3.96 / $1.98 |
| Concurrency limit | 2,500 | 500 |
| Vision | Yes | No |
| JSON output / tool calls / Anthropic-format API | Yes / Yes / Yes | Yes / Yes / Yes |

- **Off-peak** is 50% off. Peak is 01:00–04:00 and 06:00–10:00 UTC on weekdays; everything else, including weekends, is off-peak ([pricing](https://api-docs.deepseek.com/quick_start/pricing)). Batch-style nightly jobs fall naturally into off-peak.
- **Endpoints:** OpenAI- and Anthropic-compatible at `https://api.deepseek.com` ([function calling](https://api-docs.deepseek.com/guides/function_calling)).
- **JSON mode** uses `response_format: json_object`. The prompt must contain "json", and the API "may occasionally return empty content" ([JSON mode](https://api-docs.deepseek.com/guides/json_mode)). I found **no documented strict, schema-enforced mode** (unverified absence), so validate with zod and retry.
- **Rate limits** are concurrency-based. Exceeding them returns 429. Capacity can be expanded at no cost. A `user_id` field isolates KV-cache and scheduling. Keep-alive blank lines and SSE comments are sent while queued, and the connection closes if inference has not started after 10 minutes ([rate limit](https://api-docs.deepseek.com/quick_start/rate_limit)).
- **Privacy:** DeepSeek's hosted service stores data on PRC servers and permits disclosure to authorities (secondary: [Harmonic](https://www.harmonic.security/resources/deepseek-security-and-data-privacy-concerns), [VentureBeat](https://venturebeat.com/ai/is-deepseek-really-sending-data-to-china-lets-decode/)). Do not send user PII, unreleased brand assets or credentials. Disclose it as a subprocessor in our privacy policy. Self-hosting the open weights avoids this but costs more operationally.
- **Good cheap substitute for:** bulk idea generation and dedup, trend/comment summarization, hook A/B variants, first-draft scripts that Sonnet then polishes, title/description/hashtag generation, and translation of finished scripts.
- **Not a substitute for:** long HyperFrames HTML/GSAP generation where lint-pass rate matters (validate with evals first), vision critique (`v4-pro` has no vision), strict-schema calls, or anything with brand-confidential inputs.

---

## 4. Text-to-Speech

A 60s voiceover is ~150 words, ~900 characters. Cost per voiceover = 900 × $/char.

| Vendor / model | $ per 1K chars | 60s VO cost | Quality tier | Cloning | Timestamps | Latency | Commercial | Source |
|---|---|---|---|---|---|---|---|---|
| ElevenLabs **v4** | $0.08 | $0.072 | Top (newest flagship, 90+ langs) | IVC on Starter+, PVC on Creator+ | Char-level `with-timestamps` | n/s | Starter+ | [API pricing](https://elevenlabs.io/pricing/api), [models](https://elevenlabs.io/docs/models), [plans](https://elevenlabs.io/pricing) |
| ElevenLabs v4 Turbo / Flash v2.5 | $0.04 | $0.036 | High | same | Yes | ~100ms / ~75ms | Starter+ | same |
| ElevenLabs v3 / Multilingual v2 | $0.08 | $0.072 | Top (expressive tags) | same | Yes (check v3 per model) | n/s | Starter+ | same |
| OpenAI tts-1 / tts-1-hd | $0.015 / $0.030 | $0.0135 / $0.027 | Mid | No | No (use STT) | Low | Yes | [OpenAI pricing](https://developers.openai.com/api/docs/pricing) |
| OpenAI gpt-4o-mini-tts | $0.60/M text in + $12/M audio tokens | ~$0.01–0.02 (unverified token/sec) | Mid-high, steerable | No | No | Low | Yes | same |
| Google Gemini 3.8 Flash TTS | $0.50/M in + $9/M audio out (doubles 2027-01-01) | ~$0.014 (assumes ~25 audio tok/s) | High | No | No | — | Yes | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Google Cloud Chirp 3 HD | $0.030 (first 1M chars free) | $0.027 | High | Instant custom voice $0.06 | Marks / SSML | — | Yes | [GCP TTS pricing](https://cloud.google.com/text-to-speech/pricing) |
| Cartesia Sonic | ~$0.037–0.050 (plan); overage $0.038–0.065 | ~$0.035–0.045 | High, very low latency | IVC Pro+, PVC Startup+ | Word timestamps (unverified on pricing page) | Very low | Pro+ | [Cartesia pricing](https://cartesia.ai/pricing) |
| Fish Audio s2.1-pro | $0.015 per 1K UTF-8 bytes | $0.0135 | High | Yes | n/s | — | Yes | [Fish API pricing](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits) |
| MiniMax speech-2.8 HD / Turbo | $0.100 / $0.060 (secondary) | $0.09 / $0.054 | High, multilingual | Yes (extra fee) | Subtitle output (unverified) | — | Yes | [OpenRouter](https://openrouter.ai/minimax/speech-2.8-hd) (secondary) |
| Inworld TTS-2 / TTS-2 Flash | $0.025 / $0.015 on-demand (down to $0.0125 / $0.007 on Growth) | $0.0225 / $0.0135 | High (top-ranked arenas) | IVC + PVC, all plans | Yes (listed feature) | Low | Yes | [Inworld pricing](https://inworld.ai/pricing) |
| Hume Octave 2 | ~$0.025–0.15 (secondary) | — | High, emotive | Yes | — | — | **Reported API sunset 2026-11-13 (secondary)** | [eesel](https://www.eesel.ai/blog/hume-ai-pricing) |
| Deepgram Aura-2 (direct or Workers AI) | $0.030 | $0.027 | Mid-high, English/Spanish | No | — | Very low | Yes | [Deepgram](https://deepgram.com/pricing), [Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| Workers AI MeloTTS | $0.0002 per audio min | $0.0002 | Low | No | No | — | MIT | [Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| Kokoro-82M (DeepInfra or self-host) | $0.00062 (DeepInfra) | $0.00056 | Mid (surprisingly good for English) | No | Self-host can emit | Very low | Apache-2.0 | [DeepInfra](https://deepinfra.com/hexgrad/Kokoro-82M/voice) |
| Chatterbox (Resemble) | Self-host GPU cost only | ~$0 marginal | High, zero-shot cloning | Yes | No | — | MIT (secondary). **PerTh watermark** in every clip | [Resemble](https://resemble.ai/chatterbox) |
| Orpheus (Canopy Labs) | Self-host | ~$0 marginal | High, emotive tags | Yes | No | — | License not verified | — |

Recommendation: default to **ElevenLabs v4 Turbo / Flash v2.5** at $0.036 per VO. Its char timestamps remove a separate alignment step. Use **v4** for premium. The budget tier is **Inworld TTS-2 Flash** or **Fish s2.1-pro** at ~$0.0135, plus Groq Whisper alignment. **Kokoro** is the near-free fallback for free-tier users.

---

## 5. Captions / word timestamps

| Option | Price | Word timing | Notes |
|---|---|---|---|
| ElevenLabs TTS `with-timestamps` | Included in TTS | Per character, original + `normalized_alignment` | Aggregate chars into words. Use normalized alignment for numbers ([docs](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps)) |
| Groq `whisper-large-v3-turbo` | **$0.04/hr** ($0.00067/min), 10s minimum | `timestamp_granularities[]=word` with `verbose_json` | The cheapest hosted option ([Groq STT](https://console.groq.com/docs/speech-to-text)) |
| Groq `whisper-large-v3` | $0.111/hr | Yes | Lower WER (10.3% vs 12%) |
| Workers AI Whisper / large-v3-turbo | $0.0005/min | Yes | Already on Cloudflare ([Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/)) |
| Deepgram Nova-3 pre-recorded | $0.0043/min (mono), $0.0052 (multi) | Yes | [Deepgram](https://deepgram.com/pricing) |
| AssemblyAI Universal-3.5 Pro / Universal-2 | $0.21/hr / $0.15/hr | Yes | $50 free credit ([AssemblyAI](https://www.assemblyai.com/pricing)) |
| ElevenLabs Scribe v2 | $0.22/hr | Yes | [ElevenLabs API pricing](https://elevenlabs.io/pricing/api) |
| OpenAI gpt-4o-mini-transcribe / whisper-1 | $0.003 / $0.006 per min | whisper-1 has word timestamps | [OpenAI pricing](https://developers.openai.com/api/docs/pricing) |
| Fish transcribe-1 | $0.36/hr | — | [Fish](https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits) |
| WhisperX (self-host or Replicate) | ~$0.003–0.045/run on Replicate (secondary) | wav2vec2 forced alignment, the most precise | [Replicate](https://replicate.com/victor-upmeet/whisperx) |

Because we already know the script text, the most accurate path is **TTS-native timestamps**. For non-ElevenLabs voices, use Groq or Workers AI Whisper with word granularity, then snap words to the known script (diff-align) so the transcription can't introduce typos. Cost is under $0.001 per video.

---

## 6. Visuals

### 6a. AI images (9:16 backgrounds and illustrations)
| Model | Price / image | Source |
|---|---|---|
| Gemini **Nano Banana 2.1** | $0.0336 (1K), $0.0504 (2K), $0.113 (4K) | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Gemini 3.1 Flash Image (Nano Banana 2) | $0.067 (1K), $0.101 (2K) | same |
| Gemini 3 Pro Image (Nano Banana Pro) | $0.134 (1K/2K) | same |
| Gemini 3.1 Flash Lite Image | $0.0336 (1K) | same |
| FLUX.2 [pro] on fal | $0.03 first MP + $0.015/extra MP (1080×1920 ≈ $0.045–0.06) | [fal](https://fal.ai/models/fal-ai/flux-2-pro) |
| FLUX.1 [schnell] on fal | $0.003/MP | [fal pricing](https://fal.ai/pricing) |
| FLUX.2 klein-9b on Workers AI | $0.015 first MP + $0.002/extra MP | [Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| Qwen-Image on fal | $0.02/MP | [fal](https://fal.ai/models/fal-ai/qwen-image) |
| GPT Image 2 portrait 1024×1536 | $0.005 low / $0.041 med / $0.165 high | [OpenAI image guide](https://developers.openai.com/api/docs/guides/image-generation) |
| GPT Image 1 Mini portrait | $0.006 / $0.015 / $0.052 | same |
| Recraft V4.1 / Flash / Pro / Vector | $0.035 / $0.007 / $0.21 / $0.08 | [Recraft API](https://www.recraft.ai/pricing?tab=api) |
| Ideogram (API) | 1¢ per credit. Per-image credits were not retrievable (page loads dynamically) | [Ideogram](http://ideogram.ai/pricing/?pricing_tab=api) |

Pick: **Nano Banana 2.1 at 1K (~$0.034)** for illustrative backgrounds with text, **FLUX.2 pro** for photoreal, and **Recraft V4.1 Flash ($0.007) or Vector** for flat or icon assets that drop cleanly into HTML scenes.

### 6b. AI video clips
| Model | $/sec (1080p unless noted) | Max length | 9:16 | Access | Source |
|---|---|---|---|---|---|
| Veo 3.1 Standard | $0.20 no audio / $0.40 audio (4K $0.40/$0.60) | 8s (extend +7s ×20) | Yes | fal, Runway, Vertex | [fal](https://fal.ai/models/fal-ai/veo3.1), [Runway](https://docs.dev.runwayml.com/guides/pricing/) |
| Veo 3.1 Fast | $0.10 / $0.15 | 8s | Yes | fal, Runway | same |
| Gemini Omni Flash | ~$0.10/s at 720p | — | — | Gemini API (Veo 3.1 preview ids shut down 2026-10-22) | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [video docs](https://ai.google.dev/gemini-api/docs/video) |
| Kling v3 Pro | $0.112 no audio / $0.168 audio | n/s | n/s | fal | [fal](https://fal.ai/models/fal-ai/kling-video/v3/pro/text-to-video) |
| Kling v2.5 Turbo Pro (i2v) | $0.07 | — | — | fal | [fal pricing](https://fal.ai/pricing) |
| Seedance 2.0 | $0.682 (1080p, audio), $0.3034 (720p) | 4–15s | Yes | fal | [fal](https://fal.ai/models/bytedance/seedance-2.0/text-to-video) |
| MiniMax H3 Max / Turbo (Hailuo successor) | $0.03 / $0.015 (fal estimate at 720p) | — | — | fal | [fal pricing](https://fal.ai/pricing) |
| Runway gen4.5 / gen4_turbo | $0.12 / $0.05 | — | — | Runway API | [Runway](https://docs.dev.runwayml.com/guides/pricing/) |
| Wan 2.5/2.6 | ~$0.05 (480p–1080p, secondary) | — | — | fal | (secondary) |
| Sora 2 / 2 Pro | Was $0.70/s at 1080p. **API shut down 2026-09-24 (secondary)** | — | — | — | [framesurfer](https://framesurfer.com/blogs/sora-2-pricing) |

An 8s 1080p 9:16 b-roll clip costs **$0.80 (Veo Fast, no audio), $0.90 (Kling v3, no audio), $1.60 (Veo Std, no audio) or $3.20 (Veo Std with audio)**. We overlay our own VO and music, so always request **no audio**.

### 6c. Stock footage and images
| API | Cost | Limits / terms |
|---|---|---|
| **Pexels** | Free | 200 req/hr and 20K/month by default, raisable for free. Portrait filter on photos **and videos**. Credit Pexels and photographers. May not replicate Pexels' core functionality ([docs](https://www.pexels.com/api/documentation/)) |
| **Pixabay** | Free | Photos and videos API with orientation filter. Known terms are ~100 req/60s, cache results 24h, no permanent hotlinking (download to R2). The page returned 429 today, so this is **unverified** ([docs](https://pixabay.com/api/docs/)) |
| **Unsplash** | Free | 50/hr in demo, 1,000/hr in production. **Must hotlink** `images.unsplash.com` URLs and call `/download` tracking. Attribution required. Awkward for baking into a rendered MP4 ([docs](https://unsplash.com/documentation)) |
| **Storyblocks API** | Sales-negotiated, by libraries and MAU | Unlimited downloads under an enterprise license. The cleanest commercial indemnity ([Storyblocks API](https://www.storyblocks.com/api)) |
| **Coverr** | Free API | Requires a clickable logo attribution. API wording restricts resale ([docs](https://coverr.co/api/docs/)) |

Default: Pexels plus Pixabay videos (portrait), downloaded to R2 with license metadata stored. Add Storyblocks once we have revenue, for indemnity.

### 6d. Music and SFX
| Option | Price | Notes |
|---|---|---|
| **ElevenLabs Music** (`music_v2_5`) | $0.15/min, 3s–5min, finetune $1.50 | "Cleared for nearly all commercial uses" on Starter+ ([API pricing](https://elevenlabs.io/pricing/api), [Music docs](https://elevenlabs.io/docs/capabilities/music)) |
| **ElevenLabs SFX** | $0.12/min | [API pricing](https://elevenlabs.io/pricing/api) |
| **Google Lyria 3.5** | $0.08 per full song; Lyria 3 Clip (30s) $0.04 | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Stable Audio 2.5 | ~$0.20 per generation (secondary) | [eachlabs](https://www.eachlabs.ai/stability/stable-audio/stable-audio-2-5-text-to-audio) |
| Suno | **No public API**. Invite-only partner program; third-party wrappers are ToS-risky | [MBW](https://www.musicbusinessworldwide.com/suno-explores-developer-api-seeking-apps-that-unlock-experiences-generative-music-makes-possible-for-the-first-time/) |
| Udio | No official public API found (unverified) | — |
| Our `Music` table (Pixabay/FMA-sourced, R2) | $0 marginal | Already BPM-tagged. Keep as the default |

Recommendation: library music by default (beat-sync already exists). Offer **Lyria 3 Clip ($0.04)** or **ElevenLabs Music ($0.15 per 60s)** as "custom score" premium options. Use ElevenLabs SFX for whooshes and risers, generated once and cached as a reusable SFX library.

---

## 7. HyperFrames and alternatives

**HyperFrames now:**
- `hyperframes` **0.8.212**, published 2026-10-28. Releases ship several times a day, with `alpha`, `hdr` and `desktop` dist-tags ([npm](https://registry.npmjs.org/hyperframes)). Apache-2.0, ~74.4K GitHub stars ([GitHub](https://github.com/heygen-com/hyperframes)).
- Packages: CLI, `@hyperframes/core|engine|producer|studio|player|shader-transitions|aws-lambda`. CLI commands: `init`, `preview`, `render`, `add <block>`, `skills update`, lint, inspect.
- The registry has **~450 blocks** (transitions, kinetic type, captions, charts, maps, 3D, camera moves). Animation adapters cover GSAP, CSS, Lottie, Three.js, Anime.js and WAAPI. Rendering is deterministic headless-Chrome seek plus FFmpeg ([GitHub](https://github.com/heygen-com/hyperframes)).
- **Lambda:** Step Functions run Plan → Map(RenderChunk) → Assemble from one function, at a 10,240 MB example memory, with up to 256 chunks and a 15-minute cap per invocation. SDR only. **No completion webhook** (poll `lambda progress` or watch Step Functions). The example cost is 480 frames on 5 Lambdas ≈ **$0.0214** ([Lambda docs](https://hyperframes.heygen.com/deploy/aws-lambda.md)). For our SQS flow, add an EventBridge rule on Step Functions completion → SQS/HTTP callback → resume the Mastra/Inngest run.
- **Performance:** a 300-frame 1080p comp rendered in 9.8s, and one expensive CSS declaration pushed it to 25s. `--quality draft` gives fast previews ([FAQ](https://hyperframes.heygen.com/faq.md)).
- **October 2026 changes:** arm64 default for Lambda video work, cost-aware chunk splitting (~⅓ faster 4K), plan-without-reading-video-bytes, motion blur, GIF export, audio-loss checks, a hosted MCP in the official registry, and the desktop app moved to hyperframes.studio ([changelog](https://hyperframes.heygen.com/changelog.md)).
- **9:16:** set by width/height (`--width 1080 --height 1920`). No dedicated vertical page exists, and the Lambda CLI shows arbitrary dimensions.
- **Limits:** Node 22+ and FFmpeg required. Optional HeyGen cloud render bills HeyGen credits (price not published) ([FAQ](https://hyperframes.heygen.com/faq.md)).

**Alternatives (comparison only):**
- **Remotion** (`remotion` 4.0.539, 2026-10-26). React-based and the most mature Lambda renderer. The license is free for organizations of ≤3 people. Otherwise Creators cost $25/seat/month and **Automators $0.01 per render with a $100/month minimum**. Enterprise starts at $500/month ([remotion.pro/license](https://www.remotion.pro/license)). Viable, but it adds per-render license cost, and LLMs write plain HTML/CSS/GSAP more reliably than Remotion's frame-driven React.
- **Motion Canvas.** TypeScript generator-based animation with an editor. Effectively dormant: last npm publish 3.17.2 on 2024-12-14 (npm). Not recommended.
- **Revideo.** A Motion Canvas fork aimed at headless or automated rendering. Last publish 0.11.0 on 2026-07-10 (npm), with a small user base (secondary: [pkgpulse](https://www.pkgpulse.com/guides/remotion-vs-motion-canvas-vs-revideo-programmatic-video-2026)). Possible, but it is a niche bet.
- **Shotstack.** JSON-timeline cloud render. $0.20/min on PAYG, down to $0.05/min on Volume ($499 for 10K min/month) ([pricing](https://shotstack.io/pricing/)). Its AI add-ons are marked up (a Seedance 5s clip is $2.96). Good as a fallback renderer, but its timeline model is less expressive than HTML.
- **Creatomate.** Template and JSON render API. ~14 credits per minute of 720p25. Plan prices were not visible on the page ([pricing](https://creatomate.com/pricing)).
- **JSON2Video.** A similar JSON-to-video API. Pricing not verified today.

Verdict: stay on HyperFrames. Self-hosted Lambda costs about 1/20th of Shotstack's per-minute rate, with no license fee, and its registry of LLM-friendly blocks is the moat.

---

## 8. Orchestration for multi-minute pipelines

| Option | Pricing | Durability model | Mastra fit | Notes |
|---|---|---|---|---|
| **Inngest** | Free: 50K executions, 5 concurrent steps. Pro: from $99/month (1M executions, then ~$15–50 per M, 100 concurrent). Business from $499 ([pricing](https://www.inngest.com/pricing)) | Per-step memoization, retries, waitForEvent, cron, flow control | **First-class** (`@mastra/inngest`, the only production runner Mastra documents) ([runners](https://mastra.ai/docs/deployment/workflow-runners.md)) | Works over HTTP from ECS or Vercel. Per-user concurrency keys map to our credit tiers |
| **Vercel Workflow** (`workflow` 5.2.3) | $0.02 per 1K events (~3 per step), $0.50/GB written and per GB-month retained, plus function compute ([pricing](https://vercel.com/docs/workflows/pricing)) | Event-sourced `'use workflow'`/`'use step'`. Unlimited run and sleep duration. **Step max = function max duration**. 50 MB payload. Postgres "World" for self-hosting | **No Mastra integration documented** | Great if we went AI-SDK-only on Vercel. Renders still can't run inside it (chromium/ffmpeg) |
| **Trigger.dev v4** (`@trigger.dev/sdk` 4.8.1) | Hobby $10, Pro $50, plus compute ($0.0000338/s small-1x up to $0.00068/s large-2x) and $0.000025 per run. **No max run duration**. Waits not billed. Self-hostable, Apache-2.0 ([pricing](https://trigger.dev/pricing)) | Checkpoint/restore of long tasks | None native (call Mastra inside tasks) | Strong for running long compute itself. Overlaps with our ECS |
| **SQS + Lambda (existing)** | ~free at our scale | At-least-once queue. Render state lives in Step Functions | Mastra suspends; a callback resumes | Keep for the render leg only |
| **BullMQ on ECS** | Redis cost only | Redis-backed retries, no step memoization | Manual | More ops, less visibility, re-implements Inngest |

**Recommendation: Inngest as the durable executor for Mastra workflows, hosted in the ECS generate-server.** Keep SQS → HyperFrames Lambda for rendering, with a Step Functions completion event → Inngest event → `resume`. Use Inngest cron for the publish scheduler, because Mastra's built-in scheduler is best-effort and does not replay missed ticks.

At ~15–25 executions per video, the free tier covers ~2–3K videos/month, and Pro ($99) covers ~40–60K. Choose Vercel Workflow only if Mastra were dropped.

---

## 9. COGS per 60-second video

**Assumptions:**
- LLM token budget per video: ~40K input (system prompts, HyperFrames skill, brand kit, critique context) and ~25–30K output (script ~2K, scene plan ~3K, HTML for ~8 scenes ~15K, critique and fixes ~5K, thinking included). Uncached list prices, so caching lowers these figures.
- 900-char VO.
- Render: on a single 3 GB x86 Lambda for 120s, 360 GB-s × $0.0000166667 = **$0.006** ([Lambda pricing](https://aws.amazon.com/lambda/pricing/)). On the HyperFrames distributed 10 GB stack for 1,800 frames, scaling the docs' $0.0214 per 480 frames gives ≈ **$0.05–0.08**. Arm is ~20% cheaper.
- R2 storage for a ~30 MB MP4 plus assets is about $0.0005/month, with zero egress ([R2 pricing](https://developers.cloudflare.com/r2/pricing/)).

| Line item | (a) Cheapest | (b) Standard | (c) Premium |
|---|---|---|---|
| LLM | DeepSeek flash, peak: 40K×$0.30 + 30K×$1.20 = **$0.048** (off-peak $0.024) | Sonnet 5.5: 40K×$2 + 30K×$10 = $0.38. Haiku for tagging ≈ $0.002. **≈ $0.38** (≈ $0.25 with caching; $0.19 batch) | Opus 5.5: 40K×$4 + 30K×$20 = $0.76, plus vision critic of keyframes (~20K in, 2K out) $0.12. **≈ $0.88** |
| TTS (900 chars) | Inworld TTS-2 Flash or Fish s2.1-pro **$0.0135** (Kokoro $0.0006) | ElevenLabs v4 Turbo **$0.036** | ElevenLabs v4 **$0.072** |
| Captions / alignment | Groq turbo **$0.0007** | ElevenLabs timestamps **$0** | **$0** |
| Images | 0 (HTML motion graphics + Pexels/Pixabay stock, $0) | 3× Nano Banana 2.1 1K = **$0.10** | 3× Nano Banana 2.1 = **$0.10** |
| AI video | — | — | 1× 8s 1080p no-audio: Veo 3.1 Fast **$0.80** / Kling v3 $0.90 / Veo 3.1 Std **$1.60** |
| Music / SFX | Library **$0** | Library **$0** | ElevenLabs Music 60s **$0.15** (or Lyria Clip $0.04) |
| Render (Lambda) | **$0.006–0.05** | **$0.01–0.06** | **$0.05–0.08** |
| Storage, queue, Inngest | ~$0.001 | ~$0.001 | ~$0.001 |
| **Total** | **≈ $0.07–0.12** | **≈ $0.50–0.60** | **≈ $2.05–2.90** (Veo Fast vs Std) |

Sensitivity:
- Retries and critic loops are the largest swing factor. Two failed HTML generations add ~$0.30 on Sonnet or $0.60 on Opus, so cap retries and fall back down-model (Opus → Sonnet → DeepSeek) on lint-only fixes.
- Caching the ~10–20K-token HyperFrames system/skill prompt (1h TTL, read at 5% on Sonnet/Opus 5.5) cuts input cost ~70–90%.
- Scheduled, non-urgent videos through Batch API halve Claude cost. DeepSeek off-peak halves DeepSeek cost.
- Veo audio-on doubles the video line. Always request audio off.

---

## 10. Recommended stack (summary)

| Layer | Choice |
|---|---|
| Agent framework | **Mastra 1.79.x (pinned)** inside the ECS `generate-server` (Express adapter); `@mastra/pg` on Neon in an isolated schema |
| Durable execution and cron | **Inngest** via `@mastra/inngest`. SQS → HyperFrames Lambda for render, with a completion callback to resume |
| LLMs | Haiku 5.5 (classify/route), Sonnet 5.5 (script and HTML default), Opus 5.5 (premium HTML and vision critic). DeepSeek flash (bulk ideation, drafts, metadata; off-peak). Fallback arrays in Mastra model config |
| TTS | ElevenLabs v4 Turbo/Flash (default, char timestamps), v4 (premium), Inworld TTS-2 Flash or Fish (budget), Kokoro (free tier) |
| Captions | ElevenLabs timestamps. Otherwise Groq/Workers-AI Whisper word timestamps snapped to the script |
| Images | Nano Banana 2.1 (default), FLUX.2 pro (photoreal), Recraft V4.1 Flash/Vector (flat assets) |
| AI video | Veo 3.1 Fast no-audio via fal (default premium), Kling v3 (alt), Seedance 2.0 for top quality |
| Stock | Pexels + Pixabay → R2 with license metadata; Storyblocks later |
| Music | Existing `Music` library; Lyria 3 Clip / ElevenLabs Music as premium; ElevenLabs SFX cached library |
| Render | HyperFrames 0.8.x self-hosted Lambda (arm64), 1080×1920 |
| Observability | Mastra tracing → PostHog/Langfuse exporter; Inngest run history |
