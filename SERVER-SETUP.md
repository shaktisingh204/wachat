# SabNode.com — Full Ubuntu Server Setup Guide

Copy-paste each section in order on your fresh Ubuntu server.

---

## 1. System Update & Essentials

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip build-essential software-properties-common apt-transport-https ca-certificates gnupg lsb-release ufw fail2ban htop tree jq certbot python3-certbot-nginx nginx redis-server
```

---

## 2. Create App User

```bash
sudo adduser --system --group --home /home/sabnode --shell /bin/bash sabnode
```

---

## 3. Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
node -v
npm -v
```

---

## 4. Install PM2

```bash
sudo npm install -g pm2
pm2 startup systemd -u sabnode --hp /home/sabnode
```

---

## 5. Configure Redis

```bash
sudo sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf
sudo sed -i 's/^# bind 127.0.0.1/bind 127.0.0.1/' /etc/redis/redis.conf
sudo systemctl enable redis-server
sudo systemctl restart redis-server
redis-cli ping
```

---

## 6. Install Puppeteer/Chrome Dependencies (for SEO workers)

```bash
sudo apt install -y libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 libcups2 libxss1 libgtk-3-0 fonts-liberation xdg-utils
```

---

## 7. Firewall Setup

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status
```

---

## 8. Create Directories

```bash
sudo mkdir -p /var/www/sabnode
sudo mkdir -p /var/secrets
sudo mkdir -p /var/log/sabnode
sudo chown -R sabnode:sabnode /var/www/sabnode
sudo chown -R sabnode:sabnode /var/log/sabnode
```

---

## 9. Clone Your Repo

```bash
sudo su - sabnode
git clone YOUR_REPO_URL /var/www/sabnode
cd /var/www/sabnode
```

---

## 10. Create `.env` File

```bash
nano /var/www/sabnode/.env
```

Paste this and fill in all values:

```env
NODE_ENV=production

# ── Database ──
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASS@YOUR_CLUSTER.mongodb.net/?appName=Cluster1
MONGODB_DB=app1

# ── Redis ──
REDIS_URL=redis://localhost:6379

# ── Auth ──
JWT_SECRET=CHANGE_THIS_TO_A_STRONG_RANDOM_SECRET
ADMIN_EMAIL=your-admin@email.com
ADMIN_PASSWORD_HASH=RUN_npm_run_hash:admin-password_TO_GENERATE

# ── Meta/WhatsApp ──
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

# ── Firebase ──
FIREBASE_ADMIN_SDK_CONFIG=/var/secrets/sabnode-firebase-admin.json
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_PROJECT.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID

# ── Google ──
GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://sabnode.com/api/crm/auth/google/callback

# ── Outlook ──
OUTLOOK_CLIENT_ID=YOUR_OUTLOOK_CLIENT_ID
OUTLOOK_CLIENT_SECRET=YOUR_OUTLOOK_CLIENT_SECRET
OUTLOOK_REDIRECT_URI=https://sabnode.com/api/crm/auth/outlook/callback

# ── Broadcast Workers ──
BROADCAST_WORKER_INSTANCES=4
BROADCAST_USE_BULLMQ=1
BROADCAST_BATCH_SIZE=200
BROADCAST_DEFAULT_MPS=80
```

Then lock it down:

```bash
chmod 600 /var/www/sabnode/.env
```

---

## 11. Upload Firebase Admin SDK Key

From your local machine:

```bash
scp sabnode-firebase-admin.json root@YOUR_SERVER_IP:/var/secrets/
```

On server:

```bash
sudo chown sabnode:sabnode /var/secrets/sabnode-firebase-admin.json
sudo chmod 600 /var/secrets/sabnode-firebase-admin.json
```

---

## 12. Install Dependencies & Build

```bash
sudo su - sabnode
cd /var/www/sabnode
npm ci
npm run build
```

---

## 13. Start with PM2

```bash
cd /var/www/sabnode
pm2 start ecosystem.config.js
pm2 save
```

This starts 3 processes:
- **sabnode-web** — Next.js app on port 3002
- **sabnode-broadcast-worker** — BullMQ workers (4 instances)
- **sabnode-worker** — Legacy broadcast poller

Verify:

```bash
pm2 status
pm2 logs sabnode-web --lines 20
```

---

## 14. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/sabnode.com
```

Paste:

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

upstream sabnode_app {
    server 127.0.0.1:3002;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name www.sabnode.com;
    return 301 https://sabnode.com$request_uri;
}

server {
    listen 80;
    listen [::]:80;
    server_name sabnode.com;

    client_max_body_size 50M;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    location /_next/static/ {
        proxy_pass http://sabnode_app;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

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
    }

    location ~ /\. { deny all; }
}
```

Enable it:

```bash
sudo ln -sf /etc/nginx/sites-available/sabnode.com /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 15. Point DNS

Add these DNS records at your domain registrar:

| Type | Name | Value |
|------|------|-------|
| A | `sabnode.com` | YOUR_SERVER_IP |
| A | `www.sabnode.com` | YOUR_SERVER_IP |

Wait for DNS propagation (5-30 min).

---

## 16. Install SSL Certificate

```bash
sudo certbot --nginx -d sabnode.com -d www.sabnode.com
```

Auto-renewal is set up automatically. Test it:

```bash
sudo certbot renew --dry-run
```

---

## 17. Configure Fail2Ban

```bash
sudo nano /etc/fail2ban/jail.local
```

Paste:

```ini
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
```

```bash
sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
```

---

## 18. PM2 Log Rotation

```bash
sudo su - sabnode
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## 19. System Tuning

```bash
sudo tee -a /etc/sysctl.conf <<'EOF'

# SabNode Performance Tuning
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
fs.file-max = 1000000
EOF

sudo sysctl -p
```

```bash
sudo tee -a /etc/security/limits.conf <<'EOF'
sabnode soft nofile 65535
sabnode hard nofile 65535
EOF
```

---

## 20. Hash Admin Password & Assign Plans

```bash
sudo su - sabnode
cd /var/www/sabnode
npm run hash:admin-password
# Copy the output hash into .env as ADMIN_PASSWORD_HASH

npm run db:assign-plan
```

---

## 21. Health Check Cron (Optional)

```bash
sudo su - sabnode
nano ~/healthcheck.sh
```

Paste:

```bash
#!/bin/bash
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/ --max-time 10)
if [ "$RESPONSE" != "200" ] && [ "$RESPONSE" != "301" ] && [ "$RESPONSE" != "302" ]; then
  echo "[$(date)] Health check failed (HTTP $RESPONSE). Restarting..."
  pm2 restart sabnode-web
fi
```

```bash
chmod +x ~/healthcheck.sh
crontab -e
# Add this line:
# */5 * * * * /home/sabnode/healthcheck.sh >> /var/log/sabnode/healthcheck.log 2>&1
```

---

## Future Deployments

```bash
sudo su - sabnode
cd /var/www/sabnode
git pull origin main
npm ci
npm run build
pm2 reload ecosystem.config.js --update-env
pm2 save
```

---

## Useful Commands

```bash
pm2 status                    # Check running processes
pm2 logs                      # View all logs
pm2 logs sabnode-web          # Web server logs only
pm2 monit                     # Real-time monitoring
pm2 restart all               # Restart everything
redis-cli ping                # Check Redis
sudo nginx -t                 # Test Nginx config
sudo systemctl reload nginx   # Reload Nginx
sudo certbot renew --dry-run  # Test SSL renewal
```
