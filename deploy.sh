#!/bin/bash
set -euo pipefail

# ============================================================
# Remawt VPS Deployment Script
# Deploys: Next.js app + Generate Server + PostgreSQL + Caddy
# Tested on: Ubuntu 22.04 / 24.04
# ============================================================

# --- Configuration ---
APP_NAME="remawt"
APP_DIR="/opt/$APP_NAME"
APP_USER="remawt"
REPO_URL=""  # Set your git repo URL here
BRANCH="main"
DOMAIN=""  # Set your domain here (e.g., remawt.com)
NEXTJS_PORT=3000
GENERATE_SERVER_PORT=3001
NODE_VERSION="20"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[x]${NC} $1"; exit 1; }

# --- Parse arguments ---
SKIP_DEPS=false
SKIP_CADDY=false
UPDATE_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --repo)       REPO_URL="$2"; shift 2 ;;
    --domain)     DOMAIN="$2"; shift 2 ;;
    --skip-deps)  SKIP_DEPS=true; shift ;;
    --skip-caddy) SKIP_CADDY=true; shift ;;
    --update)     UPDATE_ONLY=true; shift ;;
    --help)
      echo "Usage: ./deploy.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --repo URL        Git repository URL (required on first run)"
      echo "  --domain DOMAIN   Domain name for Caddy (auto-SSL)"
      echo "  --skip-deps       Skip system dependency installation"
      echo "  --skip-caddy      Skip Caddy configuration"
      echo "  --update          Only pull latest code and rebuild (skip system setup)"
      echo "  --help            Show this help"
      exit 0
      ;;
    *) err "Unknown option: $1" ;;
  esac
done

# --- Quick update mode ---
if [ "$UPDATE_ONLY" = true ]; then
  log "Running quick update..."
  cd "$APP_DIR"

  git pull origin "$BRANCH"

  log "Installing dependencies..."
  pnpm install --frozen-lockfile

  log "Running database migrations..."
  npx prisma migrate deploy

  log "Building Next.js app..."
  pnpm build

  log "Building generate-server..."
  cd generate-server
  pnpm install --frozen-lockfile
  pnpm build
  cd ..

  log "Restarting services..."
  sudo systemctl restart remawt-next
  sudo systemctl restart remawt-generate

  log "Update complete!"
  exit 0
fi

# --- Pre-flight checks ---
if [ "$(id -u)" -ne 0 ]; then
  err "This script must be run as root (use sudo)"
fi

if [ -z "$REPO_URL" ] && [ ! -d "$APP_DIR/.git" ]; then
  err "Please provide --repo URL on first deployment"
fi

# ============================================================
# 1. System Dependencies
# ============================================================
if [ "$SKIP_DEPS" = false ]; then
  log "Updating system packages..."
  apt-get update -qq
  apt-get upgrade -y -qq

  log "Installing system dependencies..."
  apt-get install -y -qq \
    curl wget git build-essential \
    postgresql postgresql-contrib \
    debian-keyring debian-archive-keyring apt-transport-https \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
    libasound2t64 libxshmfence1 fonts-liberation \
    xdg-utils

  # Caddy
  if ! command -v caddy &>/dev/null; then
    log "Installing Caddy..."
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
    apt-get install -y -qq caddy
  fi
  log "Caddy $(caddy version) installed"

  # Node.js (NodeSource)
  if ! command -v node &>/dev/null || [[ "$(node -v)" != v${NODE_VERSION}* ]]; then
    log "Installing Node.js ${NODE_VERSION}..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y -qq nodejs
  fi
  log "Node.js $(node -v) installed"

  # pnpm
  if ! command -v pnpm &>/dev/null; then
    log "Installing pnpm..."
    npm install -g pnpm
  fi
  log "pnpm $(pnpm -v) installed"
fi

# ============================================================
# 2. Create app user
# ============================================================
if ! id "$APP_USER" &>/dev/null; then
  log "Creating user: $APP_USER"
  useradd -r -m -s /bin/bash "$APP_USER"
fi

# ============================================================
# 3. PostgreSQL Setup
# ============================================================
log "Setting up PostgreSQL..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$APP_USER'" | grep -q 1 || {
  DB_PASS=$(openssl rand -base64 24)
  sudo -u postgres psql -c "CREATE USER $APP_USER WITH PASSWORD '$DB_PASS';"
  sudo -u postgres psql -c "CREATE DATABASE $APP_NAME OWNER $APP_USER;"
  log "Database created. Password: $DB_PASS"
  warn "SAVE THIS PASSWORD - you'll need it for DATABASE_URL"
  echo "DATABASE_URL=\"postgresql://$APP_USER:$DB_PASS@localhost:5432/$APP_NAME?schema=public\"" > /tmp/remawt-db-url.txt
  log "Database URL saved to /tmp/remawt-db-url.txt"
}

# ============================================================
# 4. Clone / Pull Repository
# ============================================================
if [ ! -d "$APP_DIR" ]; then
  log "Cloning repository..."
  git clone "$REPO_URL" "$APP_DIR"
else
  log "Pulling latest changes..."
  cd "$APP_DIR"
  git pull origin "$BRANCH"
fi

chown -R "$APP_USER:$APP_USER" "$APP_DIR"
cd "$APP_DIR"

# ============================================================
# 5. Environment Files
# ============================================================
if [ ! -f "$APP_DIR/.env" ]; then
  warn "No .env file found. Creating from .env.example..."
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  if [ -f /tmp/remawt-db-url.txt ]; then
    DB_URL=$(cat /tmp/remawt-db-url.txt)
    sed -i "s|DATABASE_URL=.*|$DB_URL|" "$APP_DIR/.env"
  fi
  warn "Edit $APP_DIR/.env with your actual secrets before starting the app!"
fi

if [ ! -f "$APP_DIR/generate-server/.env" ]; then
  warn "No generate-server .env file found. Creating from .env.example..."
  cp "$APP_DIR/generate-server/.env.example" "$APP_DIR/generate-server/.env"
  warn "Edit $APP_DIR/generate-server/.env with your actual API keys!"
fi

# ============================================================
# 6. Install Dependencies & Build
# ============================================================
log "Installing main app dependencies..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR && pnpm install --frozen-lockfile"

log "Running Prisma migrations..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR && npx prisma migrate deploy"

log "Building Next.js app..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR && pnpm build"

log "Installing generate-server dependencies..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR/generate-server && pnpm install --frozen-lockfile"

log "Building generate-server..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR/generate-server && pnpm build"

# ============================================================
# 7. Systemd Services
# ============================================================
log "Creating systemd services..."

cat > /etc/systemd/system/remawt-next.service << 'EOF'
[Unit]
Description=Remawt Next.js App
After=network.target postgresql.service

[Service]
Type=simple
User=remawt
Group=remawt
WorkingDirectory=/opt/remawt
ExecStart=/usr/bin/pnpm start
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/opt/remawt/.env

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/remawt

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/remawt-generate.service << 'EOF'
[Unit]
Description=Remawt Generate Server
After=network.target postgresql.service

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

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/remawt

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable remawt-next remawt-generate

# ============================================================
# 8. Caddy Configuration
# ============================================================
if [ "$SKIP_CADDY" = false ] && [ -n "$DOMAIN" ]; then
  log "Configuring Caddy for $DOMAIN..."

  cat > /etc/caddy/Caddyfile << CADDYFILE
$DOMAIN {
    # Generate server API (SSE streaming)
    handle /api/creative/generate {
        reverse_proxy localhost:$GENERATE_SERVER_PORT {
            flush_interval -1
            transport http {
                read_timeout 300s
            }
        }
    }

    # Generate server health check
    handle /api/generate-health {
        rewrite * /health
        reverse_proxy localhost:$GENERATE_SERVER_PORT
    }

    # Rendered videos from generate server
    handle /renders/* {
        reverse_proxy localhost:$GENERATE_SERVER_PORT
    }

    # Screenshots from generate server
    handle /screenshots/* {
        reverse_proxy localhost:$GENERATE_SERVER_PORT
    }

    # Everything else goes to Next.js
    handle {
        reverse_proxy localhost:$NEXTJS_PORT
    }

    # Request body size limit (for uploads)
    request_body {
        max_size 100MB
    }

    # Logging
    log {
        output file /var/log/caddy/$APP_NAME.log
    }
}
CADDYFILE

  mkdir -p /var/log/caddy

  # Validate and reload
  caddy validate --config /etc/caddy/Caddyfile
  systemctl enable caddy
  systemctl reload caddy || systemctl start caddy
  log "Caddy configured (SSL is automatic)"

elif [ "$SKIP_CADDY" = false ]; then
  warn "No --domain provided. Skipping Caddy setup."
  warn "The app will be available on ports $NEXTJS_PORT and $GENERATE_SERVER_PORT directly."
fi

# ============================================================
# 9. Firewall
# ============================================================
if command -v ufw &>/dev/null; then
  log "Configuring firewall..."
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
fi

# ============================================================
# 10. Start Services
# ============================================================
log "Starting services..."
systemctl start remawt-next
systemctl start remawt-generate

# ============================================================
# Done
# ============================================================
echo ""
echo "=========================================="
log "Deployment complete!"
echo "=========================================="
echo ""
echo "Services:"
echo "  Next.js:          systemctl status remawt-next"
echo "  Generate Server:  systemctl status remawt-generate"
echo "  Caddy:            systemctl status caddy"
echo ""
echo "Logs:"
echo "  Next.js:          journalctl -u remawt-next -f"
echo "  Generate Server:  journalctl -u remawt-generate -f"
echo "  Caddy:            journalctl -u caddy -f"
echo "  Caddy access:     tail -f /var/log/caddy/$APP_NAME.log"
echo ""
echo "Quick update (pull + rebuild + restart):"
echo "  sudo ./deploy.sh --update"
echo ""
if [ -n "$DOMAIN" ]; then
  echo "URL: https://$DOMAIN (SSL automatic via Caddy)"
else
  echo "URL: http://<your-vps-ip>:$NEXTJS_PORT"
fi
echo ""
warn "IMPORTANT: Make sure to edit these files with your actual secrets:"
echo "  $APP_DIR/.env"
echo "  $APP_DIR/generate-server/.env"
echo ""
