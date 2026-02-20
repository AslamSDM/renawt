# Build stage
FROM node:20-slim AS builder

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install

COPY tsconfig.json ./
COPY src ./src
RUN pnpm build
RUN pnpm prune --prod

# Final stage
FROM node:20-alpine

# Install Chromium and minimal fonts for Alpine
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji \
    wget

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PORT=4001

WORKDIR /app

# Copy production dependencies and built code
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Run as non-root user (node user exists in alpine node image)
USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:4001/health || exit 1

EXPOSE 4001
CMD ["node", "dist/server.js"]