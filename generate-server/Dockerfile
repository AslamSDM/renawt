# Build stage
FROM node:20-bullseye-slim AS builder

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate && pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY server.ts ./
COPY routes ./routes
COPY lib ./lib
COPY scripts ./scripts
RUN npx tsc

# Final stage
FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PORT=3001
ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/lib/generated ./lib/generated
COPY --from=builder /app/lib/generated ./dist/lib/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.ts ./

# Runtime directories (static assets + pipeline scratch space)
RUN mkdir -p public/renders public/three tmp/hf-audio tmp/hf-projects && chown -R node:node /app

USER node

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

EXPOSE 3001
CMD ["node", "dist/server.js"]
