#!/bin/bash
# ============================================================================
#  SabNode.com — Full Ubuntu Server Setup Script
#  Run as root or with sudo: sudo bash server-setup.sh
# ============================================================================

set -euo pipefail

# ── Colors for output ──────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }

# ── Check root ─────────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  err "Please run as root: sudo bash server-setup.sh"
  exit 1
fi

DOMAIN="sabnode.com"
APP_DIR="/var/www/sabnode"
APP_USER="sabnode"
NODE_VERSION="20"     # LTS
APP_PORT=3002

echo ""
echo "============================================"
echo "   SabNode.com — Full Server Setup"
echo "   Ubuntu Web Server"
echo "============================================"
echo ""

# ============================================================================
# STEP 1: System Update & Essential Packages
# ============================================================================
info "Step 1: Updating system and installing essentials..."

apt update && apt upgrade -y
apt install -y \
  curl wget git unzip build-essential software-properties-common \
  apt-transport-https ca-certificates gnupg lsb-release \
  ufw fail2ban htop tree jq certbot python3-certbot-nginx

log "System updated and essentials installed."

# ============================================================================
# STEP 2: Create Application User
# ============================================================================
info "Step 2: Creating application user '${APP_USER}'..."

if id "$APP_USER" &>/dev/null; then
  warn "User '${APP_USER}' already exists, skipping."
else
  adduser --system --group --home /home/${APP_USER} --shell /bin/bash ${APP_USER}
  log "User '${APP_USER}' created."
fi

# ============================================================================
# STEP 3: Install Node.js v20 LTS via NodeSource
# ============================================================================
info "Step 3: Installing Node.js ${NODE_VERSION}.x..."

if command -v node &>/dev/null; then
  CURRENT_NODE=$(node -v)
  warn "Node.js already installed: ${CURRENT_NODE}"
else
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt install -y nodejs
  log "Node.js $(node -v) installed."
fi

# Verify npm
log "npm version: $(npm -v)"

# ============================================================================
# STEP 4: Install PM2 (Process Manager)
# ============================================================================
info "Step 4: Installing PM2..."

if command -v pm2 &>/dev/null; then
  warn "PM2 already installed: $(pm2 -v)"
else
  npm install -g pm2
  log "PM2 $(pm2 -v) installed."
fi

# Setup PM2 to start on boot
pm2 startup systemd -u ${APP_USER} --hp /home/${APP_USER} || true
log "PM2 startup configured."

# ============================================================================
# STEP 5: Install Redis
# ============================================================================
info "Step 5: Installing Redis..."

if command -v redis-server &>/dev/null; then
  warn "Redis already installed."
else
  apt install -y redis-server
fi

# Configure Redis for production
cat > /etc/redis/redis.conf.d/sabnode.conf 2>/dev/null <<'REDISCONF' || true
# SabNode Redis overrides
maxmemory 512mb
maxmemory-policy allkeys-lru
appendonly yes
appendfsync everysec
REDISCONF

# Ensure Redis conf includes our overrides (safe — main conf may not support includes dir)
sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf 2>/dev/null || true
sed -i 's/^# bind 127.0.0.1/bind 127.0.0.1/' /etc/redis/redis.conf 2>/dev/null || true

systemctl enable redis-server
systemctl restart redis-server
log "Redis installed and running on port 6379."

# ============================================================================
# STEP 6: Install Nginx
# ============================================================================
info "Step 6: Installing Nginx..."

if command -v nginx &>/dev/null; then
  warn "Nginx already installed."
else
  apt install -y nginx
fi

systemctl enable nginx
systemctl start nginx
log "Nginx installed and running."

# ============================================================================
# STEP 7: Configure Firewall (UFW)
# ============================================================================
info "Step 7: Configuring firewall..."

ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'   # HTTP + HTTPS
ufw --force enable
log "Firewall configured: SSH, HTTP, HTTPS allowed."

# ============================================================================
# STEP 8: Create Application Directory
# ============================================================================
info "Step 8: Setting up application directory..."

mkdir -p ${APP_DIR}
mkdir -p /var/secrets
mkdir -p /var/log/sabnode

chown -R ${APP_USER}:${APP_USER} ${APP_DIR}
chown -R ${APP_USER}:${APP_USER} /var/log/sabnode
log "App directory created at ${APP_DIR}."

# ============================================================================
# STEP 9: Install Puppeteer Dependencies (for SEO workers)
# ============================================================================
info "Step 9: Installing Puppeteer/Chrome dependencies..."

apt install -y \
  libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libasound2t64 libpango-1.0-0 \
  libcairo2 libcups2 libxss1 libgtk-3-0 fonts-liberation \
  xdg-utils 2>/dev/null || \
apt install -y \
  libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 \
  libcairo2 libcups2 libxss1 libgtk-3-0 fonts-liberation \
  xdg-utils 2>/dev/null || warn "Some Puppeteer deps may need manual install."

log "Puppeteer dependencies installed."

# ============================================================================
# STEP 10: Create Nginx Configuration
# ============================================================================
info "Step 10: Creating Nginx configuration for ${DOMAIN}..."

cat > /etc/nginx/sites-available/${DOMAIN} <<NGINXCONF
# ── SabNode.com Nginx Configuration ──────────────────────────────────
# SSL will be added by Certbot automatically after running:
#   sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}

# Rate limiting zone
limit_req_zone \$binary_remote_addr zone=api:10m rate=30r/s;

# Upstream: Next.js app via PM2
upstream sabnode_app {
    server 127.0.0.1:${APP_PORT};
    keepalive 64;
}

# Redirect www to non-www
server {
    listen 80;
    listen [::]:80;
    server_name www.${DOMAIN};
    return 301 https://\$host\$request_uri;
}

# Main server block
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Max upload size (matches Next.js serverActions bodySizeLimit: 50mb)
    client_max_body_size 50M;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript
               application/xml+rss application/atom+xml image/svg+xml;

    # Static files from Next.js standalone build — cache aggressively
    location /_next/static/ {
        proxy_pass http://sabnode_app;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # API rate limiting
    location /api/ {
        limit_req zone=api burst=50 nodelay;
        proxy_pass http://sabnode_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # Meta/Facebook Webhook endpoint — higher rate limit
    location /api/webhook {
        limit_req zone=api burst=200 nodelay;
        proxy_pass http://sabnode_app;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }

    # All other requests → Next.js
    location / {
        proxy_pass http://sabnode_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://sabnode_app;
    }

    # Block common exploit paths
    location ~ /\. { deny all; }
    location ~ ^/(wp-admin|wp-login|xmlrpc) { return 444; }
}
NGINXCONF

# Enable the site
ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t && systemctl reload nginx
log "Nginx configured for ${DOMAIN}."

# ============================================================================
# STEP 11: Create Environment File Template
# ============================================================================
info "Step 11: Creating environment file template..."

cat > ${APP_DIR}/.env <<'ENVFILE'
# ============================================================================
#  SabNode.com — Production Environment Variables
#  IMPORTANT: Fill in all values before starting the application
# ============================================================================

NODE_ENV=production

# ── Database ───────────────────────────────────────────────────────────────
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASS@YOUR_CLUSTER.mongodb.net/?appName=Cluster1
MONGODB_DB=app1

# ── Redis (BullMQ + Caching) ──────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── Authentication ─────────────────────────────────────────────────────────
JWT_SECRET=CHANGE_THIS_TO_A_STRONG_RANDOM_SECRET
ADMIN_EMAIL=your-admin@email.com
ADMIN_PASSWORD_HASH=RUN_npm_run_hash:admin-password_TO_GENERATE

# ── Meta/WhatsApp Integration ──────────────────────────────────────────────
NEXT_PUBLIC_FACEBOOK_APP_ID=YOUR_FACEBOOK_APP_ID
FACEBOOK_APP_SECRET=YOUR_FACEBOOK_APP_SECRET
NEXT_PUBLIC_META_APP_ID=YOUR_META_APP_ID
NEXT_PUBLIC_META_CONFIG_ID=YOUR_META_CONFIG_ID
NEXT_PUBLIC_APP_URL=https://sabnode.com
META_VERIFY_TOKEN=YOUR_WEBHOOK_VERIFY_TOKEN
META_ADMIN_TOKEN=YOUR_LONG_LIVED_META_TOKEN
NEXT_PUBLIC_META_ONBOARDING_APP_ID=YOUR_META_APP_ID
META_ONBOARDING_APP_SECRET=YOUR_META_APP_SECRET
NEXT_PUBLIC_META_ONBOARDING_CONFIG_ID=YOUR_META_CONFIG_ID

# ── Firebase ───────────────────────────────────────────────────────────────
FIREBASE_ADMIN_SDK_CONFIG=/var/secrets/sabnode-firebase-admin.json
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_PROJECT.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID

# ── Google APIs ────────────────────────────────────────────────────────────
GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://sabnode.com/api/crm/auth/google/callback

# ── Outlook Integration ───────────────────────────────────────────────────
OUTLOOK_CLIENT_ID=YOUR_OUTLOOK_CLIENT_ID
OUTLOOK_CLIENT_SECRET=YOUR_OUTLOOK_CLIENT_SECRET
OUTLOOK_REDIRECT_URI=https://sabnode.com/api/crm/auth/outlook/callback

# ── Broadcast Workers ─────────────────────────────────────────────────────
BROADCAST_WORKER_INSTANCES=4
BROADCAST_USE_BULLMQ=1
BROADCAST_BATCH_SIZE=200
BROADCAST_DEFAULT_MPS=80

# ── Kafka (optional) ──────────────────────────────────────────────────────
# KAFKA_BROKERS=your-kafka-broker:9092
# KAFKA_TOPIC=broadcasts
ENVFILE

chown ${APP_USER}:${APP_USER} ${APP_DIR}/.env
chmod 600 ${APP_DIR}/.env
log "Environment template created at ${APP_DIR}/.env"

# ============================================================================
# STEP 12: Create Deployment Script
# ============================================================================
info "Step 12: Creating deployment script..."

cat > /home/${APP_USER}/deploy.sh <<'DEPLOYSCRIPT'
#!/bin/bash
# ── SabNode Deployment Script ──────────────────────────────────────────────
# Usage: bash ~/deploy.sh
# This pulls latest code, installs deps, builds, and restarts PM2

set -euo pipefail

APP_DIR="/var/www/sabnode"
REPO_BRANCH="main"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

cd ${APP_DIR}

info "Pulling latest code from ${REPO_BRANCH}..."
git pull origin ${REPO_BRANCH}
log "Code updated."

info "Installing dependencies..."
npm ci --production=false
log "Dependencies installed."

info "Building Next.js application..."
npm run build
log "Build complete."

info "Restarting PM2 processes..."
pm2 reload ecosystem.config.js --update-env
log "PM2 processes restarted."

info "Saving PM2 process list..."
pm2 save
log "Deployment complete!"

echo ""
echo "── Status ──────────────────────────────────"
pm2 status
echo ""
DEPLOYSCRIPT

chown ${APP_USER}:${APP_USER} /home/${APP_USER}/deploy.sh
chmod +x /home/${APP_USER}/deploy.sh
log "Deployment script created at /home/${APP_USER}/deploy.sh"

# ============================================================================
# STEP 13: Create PM2 Log Rotation
# ============================================================================
info "Step 13: Setting up PM2 log rotation..."

su - ${APP_USER} -c "pm2 install pm2-logrotate" || warn "pm2-logrotate install skipped."
su - ${APP_USER} -c "pm2 set pm2-logrotate:max_size 50M" 2>/dev/null || true
su - ${APP_USER} -c "pm2 set pm2-logrotate:retain 7" 2>/dev/null || true
su - ${APP_USER} -c "pm2 set pm2-logrotate:compress true" 2>/dev/null || true
log "PM2 log rotation configured (50MB max, 7 day retention)."

# ============================================================================
# STEP 14: Configure Fail2Ban for SSH protection
# ============================================================================
info "Step 14: Configuring Fail2Ban..."

cat > /etc/fail2ban/jail.local <<'FAIL2BAN'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port    = ssh
filter  = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled  = true
filter   = nginx-limit-req
logpath  = /var/log/nginx/error.log
maxretry = 10
FAIL2BAN

systemctl enable fail2ban
systemctl restart fail2ban
log "Fail2Ban configured."

# ============================================================================
# STEP 15: System Tuning for High Connection Apps
# ============================================================================
info "Step 15: Applying system tuning..."

cat >> /etc/sysctl.conf <<'SYSCTL'

# ── SabNode Performance Tuning ──
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.core.netdev_max_backlog = 65535
fs.file-max = 1000000
SYSCTL

sysctl -p 2>/dev/null || true

# Increase open file limits for the app user
cat >> /etc/security/limits.conf <<LIMITS
${APP_USER} soft nofile 65535
${APP_USER} hard nofile 65535
LIMITS

log "System tuning applied."

# ============================================================================
# STEP 16: Create Systemd Service for Backup Monitoring
# ============================================================================
info "Step 16: Creating health check cron..."

cat > /home/${APP_USER}/healthcheck.sh <<'HEALTHCHECK'
#!/bin/bash
# Simple health check — restarts PM2 if Next.js is down
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/ --max-time 10)
if [ "$RESPONSE" != "200" ] && [ "$RESPONSE" != "301" ] && [ "$RESPONSE" != "302" ]; then
  echo "[$(date)] Health check failed (HTTP $RESPONSE). Restarting PM2..."
  pm2 restart sabnode-web
fi
HEALTHCHECK

chown ${APP_USER}:${APP_USER} /home/${APP_USER}/healthcheck.sh
chmod +x /home/${APP_USER}/healthcheck.sh

# Add cron job (every 5 minutes)
(crontab -u ${APP_USER} -l 2>/dev/null; echo "*/5 * * * * /home/${APP_USER}/healthcheck.sh >> /var/log/sabnode/healthcheck.log 2>&1") | crontab -u ${APP_USER} -
log "Health check cron configured (every 5 minutes)."

# ============================================================================
# DONE — Print Summary
# ============================================================================
echo ""
echo "============================================"
echo -e "${GREEN}   SabNode.com Setup Complete!${NC}"
echo "============================================"
echo ""
echo "── What was installed ────────────────────────"
echo "  Node.js:    $(node -v)"
echo "  npm:        $(npm -v)"
echo "  PM2:        $(pm2 -v 2>/dev/null || echo 'installed')"
echo "  Redis:      $(redis-server --version 2>/dev/null | head -c 40)"
echo "  Nginx:      $(nginx -v 2>&1 | head -c 40)"
echo "  Certbot:    $(certbot --version 2>&1 | head -c 40)"
echo ""
echo "── Next Steps (in order) ────────────────────"
echo ""
echo "  1. CLONE YOUR REPO:"
echo "     su - ${APP_USER}"
echo "     git clone YOUR_REPO_URL ${APP_DIR}"
echo ""
echo "  2. CONFIGURE ENVIRONMENT:"
echo "     nano ${APP_DIR}/.env"
echo "     # Fill in ALL values (MongoDB, Redis, Firebase, Meta, etc.)"
echo ""
echo "  3. UPLOAD FIREBASE SERVICE ACCOUNT:"
echo "     # Copy your Firebase Admin SDK JSON to the server:"
echo "     scp sabnode-firebase-admin.json root@YOUR_SERVER:/var/secrets/"
echo "     chown ${APP_USER}:${APP_USER} /var/secrets/sabnode-firebase-admin.json"
echo "     chmod 600 /var/secrets/sabnode-firebase-admin.json"
echo ""
echo "  4. FIRST DEPLOYMENT:"
echo "     su - ${APP_USER}"
echo "     cd ${APP_DIR}"
echo "     npm ci"
echo "     npm run build"
echo "     pm2 start ecosystem.config.js"
echo "     pm2 save"
echo ""
echo "  5. POINT DNS:"
echo "     Add A record: ${DOMAIN}     → YOUR_SERVER_IP"
echo "     Add A record: www.${DOMAIN} → YOUR_SERVER_IP"
echo ""
echo "  6. INSTALL SSL CERTIFICATE:"
echo "     sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
echo "     # Auto-renewal is already configured by certbot"
echo ""
echo "  7. HASH ADMIN PASSWORD:"
echo "     cd ${APP_DIR}"
echo "     npm run hash:admin-password"
echo "     # Copy the hash into .env as ADMIN_PASSWORD_HASH"
echo ""
echo "  8. ASSIGN DEFAULT PLAN:"
echo "     npm run db:assign-plan"
echo ""
echo "  9. FOR FUTURE DEPLOYMENTS:"
echo "     su - ${APP_USER}"
echo "     bash ~/deploy.sh"
echo ""
echo "── Useful Commands ──────────────────────────"
echo "  pm2 status              # Check running processes"
echo "  pm2 logs                # View all logs"
echo "  pm2 logs sabnode-web    # View web server logs"
echo "  pm2 monit               # Real-time monitoring"
echo "  redis-cli ping          # Check Redis"
echo "  nginx -t                # Test Nginx config"
echo "  sudo certbot renew --dry-run  # Test SSL renewal"
echo "  sudo systemctl status redis nginx fail2ban"
echo ""
echo "── File Locations ───────────────────────────"
echo "  App code:      ${APP_DIR}/"
echo "  Environment:   ${APP_DIR}/.env"
echo "  Nginx config:  /etc/nginx/sites-available/${DOMAIN}"
echo "  Firebase key:  /var/secrets/sabnode-firebase-admin.json"
echo "  Logs:          /var/log/sabnode/"
echo "  PM2 logs:      ~/.pm2/logs/"
echo "  Deploy script: /home/${APP_USER}/deploy.sh"
echo ""
