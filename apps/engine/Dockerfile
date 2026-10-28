# remawt engine (ECS). Build from the REPO ROOT:
#   docker build -f apps/engine/Dockerfile -t remawt-engine .
# Runs TypeScript directly via tsx (workspace packages ship TS sources).
FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    PORT=3001 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROME_PATH=/usr/bin/chromium \
    HYPERFRAMES_TELEMETRY=0

# ffmpeg/ffprobe for mux, ingest, thumbnails; chromium + fonts for hyperframes local render and kit posters.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl openssl ffmpeg chromium \
      fonts-liberation fonts-noto-color-emoji fonts-noto-core fonts-dejavu-core \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
      libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.34.5 --activate
WORKDIR /repo

# Manifests first for layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/engine/package.json apps/engine/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/hf-kit/package.json packages/hf-kit/
COPY packages/publisher/package.json packages/publisher/
COPY packages/radar/package.json packages/radar/
RUN pnpm install --frozen-lockfile --prod=false --filter @remawt/engine... --config.dangerously-allow-all-builds=true

COPY packages ./packages
COPY apps/engine ./apps/engine
RUN pnpm --filter @remawt/db generate

WORKDIR /repo/apps/engine
RUN mkdir -p /tmp/remawt && chown -R node:node /tmp/remawt
USER node

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD curl -fsS http://localhost:3001/health || exit 1
CMD ["node", "--import", "tsx", "src/server.ts"]
