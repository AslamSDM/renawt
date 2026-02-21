#!/bin/bash
set -euo pipefail

# ============================================================
# Remawt Backend Deploy — run from your LOCAL machine
# Syncs files to VPS via rsync, then sets up everything over SSH.
# No git required on the server.
#
# Usage:
#   ./deploy.sh user@your-vps-ip --setup    # first time
#   ./deploy.sh user@your-vps-ip            # subsequent deploys
# ============================================================

REMOTE="${1:-}"
MODE="${2:---update}"
APP_DIR="/opt/remawt"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

if [ -z "$REMOTE" ]; then
  echo "Usage: ./deploy.sh user@vps-ip [--setup|--update]"
  echo ""
  echo "  --setup   First-time deploy (installs Docker, Node, PostgreSQL, etc.)"
  echo "  --update  Subsequent deploys (default — sync, rebuild, restart)"
  echo ""
  echo "Examples:"
  echo "  ./deploy.sh root@65.109.6.92 --setup"
  echo "  ./deploy.sh root@65.109.6.92"
  exit 1
fi

# ============================================================
# Step 1: Sync files to server
# ============================================================
log "Syncing project files to $REMOTE:$APP_DIR ..."

ssh "$REMOTE" "mkdir -p $APP_DIR"

rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'dist' \
  --exclude '.git' \
  --exclude 'venv' \
  --exclude '.remotion-temp' \
  --exclude 'public/renders' \
  --exclude 'public/screenshots' \
  --exclude 'logs' \
  --exclude '*.mp4' \
  --exclude '.env' \
  --exclude 'generate-server/.env' \
  --exclude 'generate-server/node_modules' \
  --exclude 'generate-server/dist' \
  --exclude 'services/scraper-service/node_modules' \
  --exclude 'services/scraper-service/dist' \
  --exclude 'services/render-service/node_modules' \
  --exclude 'services/render-service/dist' \
  ./ "$REMOTE:$APP_DIR/"

log "Files synced."

# ============================================================
# Step 2: Upload and run remote script
# ============================================================
log "Running $MODE on server..."

# Write the remote script to a temp file
REMOTE_SCRIPT=$(mktemp)
cat > "$REMOTE_SCRIPT" << 'ENDSCRIPT'
#!/bin/bash
set -euo pipefail

MODE="$1"
APP_DIR="/opt/remawt"
GENERATE_SERVER_PORT=3001
SCRAPER_PORT=4001
RENDER_PORT=4002
NODE_VERSION="20"
APP_USER="remawt"
APP_NAME="remawt"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

cd "$APP_DIR"

# ==========================================================
# FIRST-TIME SETUP
# ==========================================================
if [ "$MODE" = "--setup" ]; then
  log "Running first-time setup..."

  apt-get update -qq
  apt-get install -y -qq \
    curl wget build-essential \
    postgresql postgresql-contrib \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
    libasound2t64 libxshmfence1 fonts-liberation \
    xdg-utils

  # Docker
  if ! command -v docker &>/dev/null; then
    log "Installing Docker..."
    curl -fsSL https://get.docker.com | bash
    systemctl enable docker
    systemctl start docker
  fi
  log "Docker ready"

  if ! docker compose version &>/dev/null; then
    apt-get install -y -qq docker-compose-plugin
  fi

  # Node.js
  if ! command -v node &>/dev/null; then
    log "Installing Node.js ${NODE_VERSION}..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y -qq nodejs
  fi
  log "Node.js $(node -v) ready"

  # pnpm
  if ! command -v pnpm &>/dev/null; then
    npm install -g pnpm
  fi
  log "pnpm ready"

  # App user
  if ! id "$APP_USER" &>/dev/null; then
    useradd -r -m -s /bin/bash "$APP_USER"
  fi
  usermod -aG docker "$APP_USER" 2>/dev/null || true

  # PostgreSQL
  log "Setting up PostgreSQL..."
  systemctl start postgresql || true
  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$APP_USER'" | grep -q 1 || {
    DB_PASS=$(openssl rand -base64 24)
    sudo -u postgres psql -c "CREATE USER $APP_USER WITH PASSWORD '$DB_PASS';"
    sudo -u postgres psql -c "CREATE DATABASE $APP_NAME OWNER $APP_USER;"
    echo "DATABASE_URL=\"postgresql://$APP_USER:$DB_PASS@localhost:5432/$APP_NAME?schema=public\"" > /tmp/remawt-db-url.txt
    log "Database created. URL saved to /tmp/remawt-db-url.txt"
    warn "Password: $DB_PASS — SAVE THIS"
  }

  # .env file
  if [ ! -f "$APP_DIR/generate-server/.env" ]; then
    log "Creating generate-server/.env template..."
    cat > "$APP_DIR/generate-server/.env" << 'ENVEOF'
# OpenRouter
OPENROUTER_API_KEY=
OPENROUTER_MODEL=moonshotai/kimi-k2.5
FAST_MODEL=google/gemini-2.0-flash-001

# Google AI (optional)
GOOGLE_AI_API_KEY=
USE_GEMINI=false

# Anthropic (optional)
ANTHROPIC_API_KEY=

# R2 Storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=remawt-videos
R2_PUBLIC_URL=

# Database
DATABASE_URL=postgresql://remawt:CHANGE_ME@localhost:5432/remawt?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# Microservices
SCRAPER_SERVICE_URL=http://localhost:4001
RENDER_SERVICE_URL=http://localhost:4002

# Server
PORT=3001

# API Key (shared with Vercel frontend)
API_KEY=

# AI Speed
ENABLE_TEMPLATE_SHORTCIRCUIT=false
ENVEOF

    if [ -f /tmp/remawt-db-url.txt ]; then
      DB_URL=$(cat /tmp/remawt-db-url.txt)
      sed -i "s|DATABASE_URL=.*|$DB_URL|" "$APP_DIR/generate-server/.env"
    fi
    warn ">>> EDIT $APP_DIR/generate-server/.env WITH YOUR API KEYS <<<"
  fi

  # Systemd service
  log "Creating systemd service..."
  cat > /etc/systemd/system/remawt-generate.service << 'SVCEOF'
[Unit]
Description=Remawt Generate Server
After=network.target postgresql.service docker.service
Wants=docker.service

[Service]
Type=simple
User=remawt
Group=remawt
WorkingDirectory=/opt/remawt/generate-server
ExecStart=/usr/bin/pnpm start:prod
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/remawt/generate-server/.env
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/remawt

[Install]
WantedBy=multi-user.target
SVCEOF

  systemctl daemon-reload
  systemctl enable remawt-generate

  # Firewall
  if command -v ufw &>/dev/null; then
    log "Configuring firewall..."
    ufw allow OpenSSH
    ufw allow 3001/tcp
    ufw --force enable
  fi

  log "First-time setup complete."
fi

# ==========================================================
# BUILD & DEPLOY (runs on both --setup and --update)
# ==========================================================
log "Setting file ownership..."
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

log "Installing generate-server dependencies..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR/generate-server && pnpm install"

log "Running Prisma migrations..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npx prisma migrate deploy" 2>/dev/null || warn "Prisma migrate skipped"

log "Building generate-server..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR/generate-server && pnpm build"

# Docker microservices
if command -v docker &>/dev/null; then
  log "Starting Docker microservices..."
  cd "$APP_DIR"
  docker compose up -d --build

  log "Waiting for services..."
  sleep 8

  curl -sf http://localhost:4001/health > /dev/null 2>&1 \
    && log "Scraper: healthy" || warn "Scraper: starting..."
  curl -sf http://localhost:4002/health > /dev/null 2>&1 \
    && log "Render: healthy" || warn "Render: starting..."
  docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG \
    && log "Redis: healthy" || warn "Redis: starting..."
else
  warn "Docker not available — microservices skipped"
fi

# Restart generate server
log "Restarting generate-server..."
systemctl restart remawt-generate
sleep 2

if systemctl is-active --quiet remawt-generate; then
  log "Generate server: running"
else
  warn "Generate server failed to start!"
  warn "Check: journalctl -u remawt-generate -n 50"
fi

# Done
VPS_IP=$(curl -sf https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "=========================================="
log "Deploy complete!"
echo "=========================================="
echo ""
echo "API:  http://$VPS_IP:3001"
echo "Test: curl http://$VPS_IP:3001/health"
echo ""
echo "Commands:"
echo "  journalctl -u remawt-generate -f      # server logs"
echo "  docker compose ps                      # microservices"
echo "  docker compose logs -f scraper-service"
echo "  docker compose logs -f render-service"
echo "  sudo systemctl restart remawt-generate"
echo ""
echo "Config: $APP_DIR/generate-server/.env"

# Cleanup
rm -f /tmp/remawt-deploy.sh
ENDSCRIPT

# Upload and execute
scp -q "$REMOTE_SCRIPT" "$REMOTE:/tmp/remawt-deploy.sh"
rm -f "$REMOTE_SCRIPT"
ssh "$REMOTE" "chmod +x /tmp/remawt-deploy.sh && /tmp/remawt-deploy.sh $MODE"

log "Done!"
