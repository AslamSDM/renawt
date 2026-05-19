#!/usr/bin/env bash
set -euo pipefail

# ── Config ──────────────────────────────────────────────────
SERVER="root@178.156.225.171"
SSH_KEY="$HOME/.ssh/aslamSDM"
REMOTE_DIR="/opt/render-service"
CONTAINER_NAME="render-service"
IMAGE_NAME="render-service"
PORT=4002

# Source .env for RENDER_API_KEY and REDIS_PASSWORD if available
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  source "$ENV_FILE"
fi

RENDER_API_KEY="${RENDER_API_KEY:-}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SERVER"

echo "==> Syncing render-service to $SERVER:$REMOTE_DIR ..."
$SSH_CMD "mkdir -p $REMOTE_DIR"

rsync -avz --delete \
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.env' \
  "$SCRIPT_DIR/" "$SERVER:$REMOTE_DIR/"

echo "==> Creating docker-compose on server ..."
$SSH_CMD "cat > $REMOTE_DIR/docker-compose.yml << 'DCOMPOSE'
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --maxmemory 256mb --maxmemory-policy noeviction --stop-writes-on-bgsave-error no \${REDIS_PASSWORD:+--requirepass \${REDIS_PASSWORD}}
    volumes:
      - redis-data:/data
    healthcheck:
      test: [\"CMD\", \"redis-cli\", \"ping\"]
      interval: 10s
      timeout: 5s
      retries: 3

  render-service:
    build: .
    ports:
      - \"0.0.0.0:${PORT}:${PORT}\"
    shm_size: \"4gb\"
    environment:
      - PORT=${PORT}
      - REDIS_URL=redis://\${REDIS_PASSWORD:+:\${REDIS_PASSWORD}@}redis:6379
      - RENDER_API_KEY=\${RENDER_API_KEY:-}
      - PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
      - PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
      - CHROME_CRASHPAD_DISABLE=1
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped
    tmpfs:
      - /tmp:size=512m,uid=1000,gid=1000
      - /app/.remotion-temp:size=1g,uid=1000,gid=1000
      - /app/public/renders:size=1g,uid=1000,gid=1000
      - /app/node_modules/.remotion:size=256m,uid=1000,gid=1000
      - /home/node:size=64m,uid=1000,gid=1000
    cap_drop:
      - ALL
    cap_add:
      - SYS_ADMIN
    deploy:
      resources:
        limits:
          memory: 6G
    healthcheck:
      test: [\"CMD\", \"curl\", \"-f\", \"http://localhost:${PORT}/health\"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  redis-data:
DCOMPOSE"

echo "==> Writing .env on server ..."
$SSH_CMD "cat > $REMOTE_DIR/.env << EOF
RENDER_API_KEY=${RENDER_API_KEY}
REDIS_PASSWORD=${REDIS_PASSWORD}
EOF"

echo "==> Building and starting on server ..."
$SSH_CMD "cd $REMOTE_DIR && docker compose build --no-cache && docker compose up -d"

echo "==> Waiting for health check ..."
sleep 10
HEALTH=$($SSH_CMD "curl -sf http://localhost:${PORT}/health" 2>/dev/null || echo "FAILED")
echo "Health: $HEALTH"

if echo "$HEALTH" | grep -q '"ok"'; then
  echo ""
  echo "==> Render service is live at $SERVER:${PORT}"
  echo "    Set these in your generate-server .env:"
  echo "    RENDER_SERVICE_URL=http://65.109.6.92:${PORT}"
  [ -n "$RENDER_API_KEY" ] && echo "    RENDER_API_KEY=${RENDER_API_KEY}"
else
  echo "==> Health check failed. Check logs:"
  echo "    ssh -i $SSH_KEY $SERVER 'cd $REMOTE_DIR && docker compose logs --tail 50'"
fi
