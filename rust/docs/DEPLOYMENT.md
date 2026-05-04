# SabNode Rust API — Deployment

The Rust workspace ships a single binary, `sabnode-api`, served on
`SABNODE_PORT` (default `8080`). All required environment variables and their
purposes are documented in [`rust/.env.example`](../.env.example).

> The Rust binary is **not** deployed to Vercel — Vercel hosts the Next.js
> front-end. The Rust service runs on Fly.io or a self-hosted VPS and the
> Next.js app calls it via `RUST_API_URL` (see the bottom of this document).

---

## 1. Local development

A minimal `docker compose` for the data stores:

```yaml
# rust/compose.dev.yml
services:
  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: ["mongo-data:/data/db"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  otel-collector:
    image: otel/opentelemetry-collector:0.110.0
    ports: ["4318:4318"]   # OTLP HTTP

volumes:
  mongo-data:
```

```bash
# Bring up dependencies
docker compose -f rust/compose.dev.yml up -d

# Copy the env template and edit as needed
cp rust/.env.example rust/.env

# Run the API (auto-reload via `cargo-watch -x 'run -p sabnode-api'` if installed)
cd rust && cargo run -p sabnode-api
```

Visit `http://localhost:8080/healthz` to confirm the server is up.

---

## 2. Fly.io

Fly.io runs the same `rust/Dockerfile` we use locally.

```bash
# One-time: launch the app (do NOT deploy on first run; we want to set secrets first)
flyctl launch --no-deploy --dockerfile rust/Dockerfile --name sabnode-api

# Provide secrets (NEVER commit these)
flyctl secrets set \
  MONGODB_URI='mongodb+srv://...' \
  MONGODB_DB='sabnode' \
  REDIS_URL='redis://default:...@fly-redis.upstash.io:6379' \
  RUST_JWT_SECRET="$(openssl rand -hex 32)" \
  OTEL_EXPORTER_OTLP_ENDPOINT='https://otel.example.com:4318' \
  OTEL_SERVICE_NAME='sabnode-api' \
  SABNODE_ENV='production'

# Deploy
flyctl deploy
```

Recommended `fly.toml` snippets:

```toml
[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  path = "/healthz"
  timeout = "5s"
```

Scaling:

```bash
flyctl scale count 2 --region iad      # horizontal
flyctl scale vm shared-cpu-2x --memory 1024  # vertical
```

Logs / traces:

```bash
flyctl logs -a sabnode-api
```

---

## 3. Self-hosted VPS

### Build

On the build host (or a CI runner with the same glibc as the target VPS):

```bash
cd rust
cargo build --release --bin sabnode-api
# Artefact: rust/target/release/sabnode-api
```

Copy the binary to `/usr/local/bin/sabnode-api` on the VPS.

### Env file

Place runtime configuration at `/etc/sabnode/api.env` with mode `0640` owned
by the `sabnode` system user. Use `rust/.env.example` as the template — never
commit the real values.

### systemd unit

`/etc/systemd/system/sabnode-api.service`:

```ini
[Unit]
Description=SabNode Rust API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=sabnode
Group=sabnode
EnvironmentFile=/etc/sabnode/api.env
ExecStart=/usr/local/bin/sabnode-api
Restart=on-failure
RestartSec=5s
LimitNOFILE=65535
# Graceful shutdown so the OTLP batch exporter flushes pending spans.
KillSignal=SIGTERM
TimeoutStopSec=30s

# Hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sabnode-api
sudo journalctl -u sabnode-api -f
```

### nginx reverse proxy with TLS

`/etc/nginx/sites-available/sabnode-api.conf`:

```nginx
server {
    listen 80;
    server_name api.sabnode.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.sabnode.example.com;

    ssl_certificate     /etc/letsencrypt/live/api.sabnode.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.sabnode.example.com/privkey.pem;

    # Proxy to the Rust binary on localhost:8080.
    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

Issue / renew certs with `certbot --nginx -d api.sabnode.example.com`.

---

## 4. Pointing Next.js at the Rust service

Add a Vercel environment variable on the Next.js project:

```
RUST_API_URL=https://api.sabnode.example.com
```

Set it for **Production**, **Preview**, and **Development** scopes. The
Next.js server actions / route handlers should always read it via
`process.env.RUST_API_URL` (server-side only — never expose with the
`NEXT_PUBLIC_` prefix unless the API is public).

```bash
# Set via Vercel CLI
vercel env add RUST_API_URL production
vercel env add RUST_API_URL preview
vercel env add RUST_API_URL development
```

For local dev, add the same variable to `.env.local`:

```
RUST_API_URL=http://localhost:8080
```
