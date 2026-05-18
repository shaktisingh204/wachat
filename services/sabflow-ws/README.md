<!--
  NOTE for sibling #1 (server bootstrap task):
  This README was created by Track A Phase 3 sub-task #10 (local dev harness).
  If you author a full README later, KEEP the "## Local development" section
  below intact — append your own sections around it rather than replacing it.
-->

# @sabnode/sabflow-ws

WebSocket gateway for SabFlow realtime events. Binds on `:4002`.

## Local development

This service ships a small harness so you can boot it without depending on the
rest of the SabNode stack.

### 1. Provision env

```bash
cd services/sabflow-ws
cp .env.example .env
# edit .env if you want non-default ports / secrets
```

Variables documented in `.env.example`:

| Var | Default | Purpose |
| --- | --- | --- |
| `SABFLOW_WS_PORT` | `4002` | Port the gateway binds to. |
| `SABFLOW_WS_JWT_SECRET` | `changeme` | HMAC secret for WS JWTs. Must match the Next.js minter. |
| `REDIS_URL` | `redis://127.0.0.1:6380` | Redis URL. The bundled compose stack publishes on **6380** to dodge a host-native Redis on 6379. |
| `OTLP_ENDPOINT` | _(blank)_ | Optional OTLP HTTP exporter. Blank disables OpenTelemetry export. |

### 2. Start dependencies + dev server

```bash
./scripts/dev.sh
```

This brings up the `redis:7` container declared in `docker-compose.yml`
(exposed on `127.0.0.1:6380`, healthchecked, data persisted in the
`sabflow-ws-redis-data` named volume) and then runs `npm run dev` (sibling
task #1 provides this script — it should be a `tsx watch src/index.ts`).
Re-running is safe; an already-up Redis is left alone.

> Sibling #1 owns `package.json`. The dev harness expects these npm scripts
> to be defined there:
> - `dev`   — `tsx watch src/index.ts`
> - `build` — `tsc -p tsconfig.json` emitting to `dist/`
> - `start` — `node dist/index.js`

### 3. Smoke-test a running gateway

```bash
./scripts/probe.sh
```

Hits `/health` and then opens a WebSocket with a deliberately invalid JWT
subprotocol — the script exits non-zero unless the server rejects auth (via
upgrade error, error event, or close with a non-1000 code).

### 4. Stop the stack

```bash
docker compose down       # keep Redis data
docker compose down -v    # wipe Redis data
```

### PM2 (production-style local run)

`ecosystem.config.js` declares a single `sabflow-ws` app (fork mode, 1
instance — WS state is in-process for v0, so do not scale horizontally
without first wiring a Redis adapter). Build first:

```bash
npm run build
pm2 start ecosystem.config.js
pm2 logs sabflow-ws
```

Logs are pinned to `./logs/sabflow-ws-{out,error}.log`, matching the file
naming convention used by `services/sabwa-node/`.
