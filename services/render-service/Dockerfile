# Build stage
FROM node:20-slim AS builder

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

COPY package.json ./
RUN corepack enable && npm install --legacy-peer-deps

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc
RUN npm prune --production --legacy-peer-deps

# Final stage
FROM node:20-slim

# Install Chromium, ffmpeg, and fonts for Remotion rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-noto-cjk \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PORT=4002

WORKDIR /app

# Copy production dependencies and built code
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Copy shared Remotion components (so generated code can import from '../components/...')
COPY components ./components

# Create temp directories
RUN mkdir -p /app/.remotion-temp /app/public/renders /app/public/audio && chown -R node:node /app

# Run as non-root user
USER node

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:4002/health || exit 1

EXPOSE 4002
CMD ["node", "dist/server.js"]
