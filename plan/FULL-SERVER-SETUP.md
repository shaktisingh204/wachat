# SabNode Full Server Setup Guide

This guide provides step-by-step instructions for deploying the SabNode ecosystem on a fresh Ubuntu 22.04 or 24.04 server. It covers the Next.js frontend, Node.js workers, and the Rust-based engines (API, SabSMS, and Broadcast workers).

---

## 1. System Update & Essentials

First, ensure your system is up to date and install required system packages. Run these commands as `root` or prefix with `sudo`:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip build-essential software-properties-common \
    apt-transport-https ca-certificates gnupg lsb-release ufw fail2ban htop tree \
    jq certbot python3-certbot-nginx nginx redis-server pkg-config libssl-dev
```

*(Note: `pkg-config` and `libssl-dev` are explicitly required for compiling the Rust components.)*

---

## 2. Create Application User

It is best practice to run the application under a dedicated user rather than `root`.

```bash
sudo adduser --system --group --home /home/sabnode --shell /bin/bash sabnode
```

---

## 3. Install Node.js & PM2

SabNode requires Node.js 20.x (LTS).

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Verify versions
node -v
npm -v

# Install PM2 process manager globally
sudo npm install -g pm2
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u sabnode --hp /home/sabnode
```

---

## 4. Install Rust Toolchain

Since SabNode uses high-performance Rust engines for the API and SMS pipelines, you must install Rust to compile them. Switch to the `sabnode` user to do this:

```bash
sudo su - sabnode
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env

# Verify Rust
rustc --version
```

---

## 5. Configure Redis

Redis is used for caching and BullMQ broadcast queues. Switch back to your sudo user (or `exit` the `sabnode` user temporarily) to configure it:

```bash
sudo sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf
sudo sed -i 's/^# bind 127.0.0.1/bind 127.0.0.1/' /etc/redis/redis.conf
sudo systemctl enable redis-server
sudo systemctl restart redis-server

# Verify Redis is running
redis-cli ping
```

---

## 6. Clone the Repository

Clone your project into `/var/www/sabnode` (ensure you give permissions to the `sabnode` user).

```bash
sudo mkdir -p /var/www/sabnode
sudo chown -R sabnode:sabnode /var/www/sabnode
sudo mkdir -p /var/secrets /var/log/sabnode
sudo chown -R sabnode:sabnode /var/secrets /var/log/sabnode

sudo su - sabnode
git clone YOUR_REPO_URL /var/www/sabnode
cd /var/www/sabnode
```

---

## 7. Environment Variables

SabNode requires a robust `.env` file containing over 400 keys (from database URIs to OAuth secrets and Next.js public variables). We have prepared a complete `.env.example` file that contains all necessary keys.

```bash
cd /var/www/sabnode
cp .env.example .env
nano .env
```

**Critical Variables to Configure:**
- `MONGODB_URI` and `MONGODB_DB`
- `REDIS_URL` (usually `redis://localhost:6379`)
- `JWT_SECRET` (Generate a secure random string)
- `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH`
- All third-party integrations (Firebase, Meta/WhatsApp, Google, etc.)

Secure the `.env` file:
```bash
chmod 600 /var/www/sabnode/.env
```

If you use Firebase, upload your Admin SDK JSON:
```bash
# On your local machine:
scp sabnode-firebase-admin.json root@YOUR_SERVER_IP:/var/secrets/

# On the server (as root/sudo):
sudo chown sabnode:sabnode /var/secrets/sabnode-firebase-admin.json
sudo chmod 600 /var/secrets/sabnode-firebase-admin.json
```

---

## 8. Build the Project

You must compile both the Node.js apps and the Rust binaries before starting PM2. 

**As the `sabnode` user:**

```bash
# 1. Build the main Next.js App
cd /var/www/sabnode
npm ci
npm run build

# 2. Build the SabWa Node Service
cd /var/www/sabnode/services/sabwa-node
npm ci
npm run build

# 3. Build the Rust API & Broadcast Worker
cd /var/www/sabnode/rust
cargo build --release

# 4. Build the Rust SabSMS Engine
cd /var/www/sabnode/services/sabsms-engine
cargo build --release
```

*(Note: Rust compilation may take several minutes depending on your server's CPU).*

---

## 9. Start with PM2

Once everything is built, start the entire ecosystem using PM2:

```bash
cd /var/www/sabnode
pm2 start ecosystem.config.js
pm2 save
```

This will launch:
- `sabnode-api` (Rust API on port 8080)
- `sabnode-web` (Next.js frontend on port 3002)
- `sabwa-node` (WhatsApp engine on port 4001)
- `sabsms-engine` (Rust SMS engine on port 4002)
- `sabflow-worker` (SabFlow Node execution worker)
- `sabnode-broadcast-worker` (Rust or Node based on `.env`)
- `sabnode-cron` (Cron scheduler)

Verify the status:
```bash
pm2 status
pm2 logs
```

---

## 10. Configure Nginx & SSL

Set up Nginx as a reverse proxy for the Next.js app (running on port 3002). 

**As root/sudo:**

```bash
sudo nano /etc/nginx/sites-available/sabnode.com
```

**Nginx Configuration:**
```nginx
# Rate limiting zone
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

upstream sabnode_app {
    server 127.0.0.1:3002;
    keepalive 64;
}

# Redirect www to non-www
server {
    listen 80;
    listen [::]:80;
    server_name www.sabnode.com;
    return 301 https://$host$request_uri;
}

server {
    listen 80;
    listen [::]:80;
    server_name sabnode.com;

    # Max upload size (matches Next.js serverActions bodySizeLimit)
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
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # Meta/Facebook Webhook endpoint — higher rate limit
    location /api/webhook {
        limit_req zone=api burst=200 nodelay;
        proxy_pass http://sabnode_app;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # All other requests → Next.js
    location / {
        proxy_pass http://sabnode_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
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
```

Enable the site and restart Nginx:
```bash
sudo ln -sf /etc/nginx/sites-available/sabnode.com /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

**Install SSL using Certbot:**
Ensure your DNS records (A records for `sabnode.com` and `www.sabnode.com`) point to your server IP, then run:

```bash
sudo certbot --nginx -d sabnode.com -d www.sabnode.com
```

---

## 11. Post-Deployment Steps

Finally, assign default plans in your database and configure log rotation.

**As the `sabnode` user:**
```bash
# PM2 Log Rotation (Max 50MB per file, retain 7 days)
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true

# Database Initialization
cd /var/www/sabnode
npm run db:assign-plan
```

Your SabNode ecosystem is now fully deployed and operational!
