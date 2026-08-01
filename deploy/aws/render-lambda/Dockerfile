# Build stage
FROM node:20-bookworm-slim AS builder

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# aws-lambda-ric compiles aws-lambda-cpp from source during install
RUN rm -f /etc/apt/sources.list.d/*.sources /etc/apt/sources.list.d/*.list \
    && echo "deb [trusted=yes] http://deb.debian.org/debian bookworm main" > /etc/apt/sources.list \
    && apt-get update && apt-get install -y --no-install-recommends \
    cmake \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN corepack enable && npm install --legacy-peer-deps

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# Final stage — Lambda container image
FROM node:20-bookworm-slim

# Install Chromium, ffmpeg, and fonts for HyperFrames rendering
RUN rm -f /etc/apt/sources.list.d/*.sources /etc/apt/sources.list.d/*.list \
    && echo "deb [trusted=yes] http://deb.debian.org/debian bookworm main" > /etc/apt/sources.list \
    && apt-get update && apt-get install -y --no-install-recommends \
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
ENV CHROME_CRASHPAD_DISABLE=1
ENV HOME=/tmp

WORKDIR /app

# Lambda runtime sets LAMBDA_TASK_ROOT=/var/task; make it resolve to our code
RUN ln -s /app /var/task

# Headless shell is the automation-optimized Chromium build — required in
# Lambda (Firecracker seccomp breaks full Chromium's process model: the browser
# launches but newPage() hangs waiting for a target).
RUN npx puppeteer browsers install chrome-headless-shell \
    && mkdir -p /opt/headless-shell \
    && cp -r /tmp/.cache/puppeteer/chrome-headless-shell/*/chrome-headless-shell-linux64/. /opt/headless-shell/ \
    && chmod +x /opt/headless-shell/chrome-headless-shell

ENV PRODUCER_HEADLESS_SHELL_PATH=/opt/headless-shell/chrome-headless-shell

# Copy production dependencies and built code
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Lambda Runtime Interface Client entrypoint
ENTRYPOINT ["/usr/local/bin/npx", "aws-lambda-ric"]
CMD ["dist/handler.handler"]
