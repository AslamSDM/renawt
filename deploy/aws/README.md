# remawt on AWS

Frontend stays on **Vercel**, DB stays on **Neon**, object storage stays on
**Cloudflare R2**. Only the backend and the renderer move to AWS:

| Piece | AWS service |
|---|---|
| generate-server (Express API, port 3001) | ECS Fargate + ALB |
| HyperFrames rendering (chromium + ffmpeg) | Lambda (container image) |
| Render job queue | SQS |

No Redis/BullMQ is needed — SQS replaces it, and the Lambda uploads videos
directly to R2 (S3-compatible, same credentials the backend already uses).

## Architecture

```
Vercel (Next.js) ──► ALB ──► ECS Fargate (generate-server)
                                │
                                ├─► Neon Postgres (unchanged)
                                ├─► R2 (uploads/screenshots — unchanged)
                                └─► SQS ──► Lambda (render) ──► R2 video
```

Render flow: `submitHfRenderJob` sends an SQS message → the Lambda renders with
the HyperFrames engine → muxes audio with ffmpeg → uploads MP4 to R2 → writes
`status/{jobId}.json` to R2 → optionally POSTs `callbackUrl`.
`pollHfRenderStatus` reads the status object from R2, so the API surface of
`hfRenderClient.ts` is unchanged.

## Files

- `render-lambda/` — Lambda container image (SQS handler, engine, muxer, R2)
- `generate-server/Dockerfile` — backend image for ECS
- `deploy.sh` — `./deploy.sh all | render | backend`

## Deploy

```bash
# env vars the script needs (export them first)
export AWS_REGION=us-east-1
export R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=...
export R2_BUCKET_NAME=remawt-videos R2_PUBLIC_URL=https://pub-...r2.dev
export DATABASE_URL=postgres://...@neon...  DIRECT_DATABASE_URL=...
export API_KEY=... OPENROUTER_API_KEY=...

./deploy/aws/deploy.sh all
```

`deploy.sh` creates: ECR repos, SQS queue, Lambda (3008 MB RAM — the default
account quota, 15 min timeout, 10 GB `/tmp`, SQS event source with batch size
1), ECS cluster + Fargate service + ALB. It is idempotent — re-run to update.

### After deploy

1. **Vercel**: set `NEXT_PUBLIC_API_URL` to the ALB DNS printed by the script.
2. **HTTPS**: request an ACM cert for your API domain, add a 443 listener,
   point a `CNAME`/`A` at the ALB. (The script creates HTTP:80 only.)
3. **Remaining backend secrets** (`generate-server/.env` — ElevenLabs, Gemini,
   Dodo, PostHog, VEO, etc.) must be added to the ECS task definition as
   environment entries or SecretsManager secrets — see `deploy_backend()` in
   `deploy.sh`.
4. **IAM**: the Lambda role gets SQS + basic execution policies (R2 auth comes
   from env creds). Give generate-server's ECS task an IAM role with
   `sqs:SendMessage` (or use `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` env).
5. **Scraper service**: not deployed to AWS by default. Either keep it on a VPS,
   or push its existing Dockerfile to ECR and run it as a second Fargate
   service (it uses Puppeteer — no changes needed).

## Limits & notes

- **Lambda caps at 15 min** — videos longer than ~12 min (at 30 fps) fail fast
  with a clear error. Long renders need the Fargate/HTTP render path
  (`RENDER_SERVICE_URL`, no `RENDER_QUEUE_URL`).
- **Lambda memory is 3008 MB** (the account's default quota). Request a quota
  increase in the AWS console (up to 10240 MB) for higher-memory renders, then
  bump `--memory-size` in `deploy.sh`.
- **Chromium must be the headless shell**: full Chromium launches in Lambda but
  `browser.newPage()` hangs under Firecracker seccomp. The image installs
  `chrome-headless-shell` and bakes `PRODUCER_HEADLESS_SHELL_PATH`; the Lambda
  env also sets `PUPPETEER_DANGEROUS_NO_SANDBOX=true`.
- **Batch size 1** — one render per invocation so a slow job never blocks the
  next one.
- The old HTTP render-service (`services/render-service/`) is untouched and
  still works: just don't set `RENDER_QUEUE_URL` and it's used as before. The
  switch is purely env-driven.
