# @sabnode/sabflow-triggers

Standalone Node service that hosts long-lived **IMAP IDLE** workers for SabFlow's `email-received` triggers. Each active trigger gets its own `EmailTriggerWorker` that opens an IMAP connection, watches the configured folder, parses inbound messages, and POSTs a normalised payload to the Next.js internal endpoint:

```
POST {SABFLOW_API_URL}/api/sabflow/internal/trigger/email
```

The Next.js receiver is responsible for calling `enqueueExecution(triggerId, payload)`.

This service mirrors `services/sabflow-ws/` and `services/sabwa-node/` in shape — Express on a private port, PM2-managed, env-driven config — and **is not** a Vercel Function.

## Why a standalone service (not a Vercel Function)

Per [CLAUDE.md](../../CLAUDE.md) and the Track B ADRs:

- **IMAP IDLE is a long-lived TCP socket.** Vercel Fluid Compute is request-shaped — function lifetime is bounded by the request, and instance recycling would kill an IDLE socket mid-watch.
- **Cost & lifecycle.** Long-lived sockets billed as continuous compute on Fluid would be both wasteful and brittle; PM2 fork-mode with autorestart is the right primitive.
- **Co-location with sabwa-node / sabflow-ws.** Those services already follow this pattern; ops scripts, log conventions, and deploy targets are reused.

## Architecture

```
        ┌────────────────────┐
        │ Next.js (Vercel)   │
        │  /api/sabflow/     │
        │  internal/trigger/ │◀──── normalised payload (POST)
        │  email             │
        └─────────┬──────────┘
                  │ enqueueExecution()
                  ▼
        ┌────────────────────┐
        │  SabFlow executor  │
        └────────────────────┘

        ┌────────────────────┐
        │ sabflow-triggers   │       IMAP IDLE / poll
        │   (this service)   │ ────────────────────────▶  Mail server
        │   Express :4003    │
        │   WorkerPool       │
        │   ├ Worker(t1)     │
        │   ├ Worker(t2)     │
        │   └ Worker(tN)     │
        └──────────┬─────────┘
                   │ GET /api/sabflow/internal/trigger/email/active   (every 60s)
                   ▼
              Next.js index endpoint
```

- The pool refreshes the active-trigger list every `60s` and reconciles workers (start new, stop removed).
- Each worker opens an IMAP connection, runs `IDLE`, and listens for `exists` events to drain new UIDs.
- Servers without IDLE capability fall back to **`60s LIST` polling**.
- Disconnects trigger reconnect with **exponential backoff `1s → 60s`** (full jitter).

## Attachments + SabFiles policy

Inbound attachments are emitted in the payload as **metadata only**:

```json
{
  "attachments": [
    { "filename": "...", "contentType": "...", "size": 1234, "sabFileId": null }
  ]
}
```

The actual upload to SabFiles (R2-backed) is **NOT** performed in this worker — see the file-header JSDoc in `src/email-imap.ts`. Per the SabFiles policy in `/CLAUDE.md`, every file in SabNode must originate through the SabFiles library/upload flow; the dedicated SabFiles uploader sibling owns that step. Until it lands, `sabFileId` is `null` and the Next.js receiver flags it.

## Required env vars

Copy `.env.example` to `.env` and fill in:

| Var                       | Required | Default                 | Purpose |
| ------------------------- | -------- | ----------------------- | ------- |
| `SABFLOW_TRIGGERS_PORT`   | no       | `4003`                  | HTTP port. `sabwa-node` = 4001, `sabflow-ws` = 4002, this = 4003. |
| `SABFLOW_API_URL`         | yes      | `http://localhost:3000` | Base URL of the Next.js side. The worker POSTs trigger payloads here. |
| `SABFLOW_INTERNAL_TOKEN`  | **yes**  | —                       | Shared secret for `Authorization: Bearer …` on every call to `/api/sabflow/internal/*`. Must match the Next.js side. |

Credentials are **never** stored in this service. Each trigger references a `credentialId`; the credentials resolver (sibling `./credentials.ts`, with an HTTP fallback to `/api/sabflow/internal/credentials/:id`) decrypts and returns `{ host, port, secure, user, pass }` at connect time.

## How to run

### Local dev

```bash
cd services/sabflow-triggers
npm install
cp .env.example .env   # fill in SABFLOW_INTERNAL_TOKEN at minimum
npm run dev            # tsx watch src/email-imap.ts
```

### Production

```bash
cd services/sabflow-triggers
npm install
npm run build          # tsc → dist/
pm2 start ecosystem.config.js --update-env
```

PM2 app name: **`sabflow-triggers`**. Logs land under `~/.pm2/logs/sabflow-triggers-{out,error}.log`.

### Health check

```bash
curl http://localhost:4003/healthz
# { "status": "ok", "workers": 7 }
```

## Internal endpoints expected on the Next.js side

| Method | Path                                                  | Purpose |
| ------ | ----------------------------------------------------- | ------- |
| `GET`  | `/api/sabflow/internal/trigger/email/active`          | Returns the active-trigger list (array of `{ id, workspaceId, flowId, credentialId, folder, search? }`). |
| `GET`  | `/api/sabflow/internal/credentials/:id`               | Returns decrypted `{ host, port, secure, user, pass }` for the given credentialId. |
| `POST` | `/api/sabflow/internal/trigger/email`                 | Receives the normalised payload and calls `enqueueExecution(triggerId, payload)`. |

All three must verify `Authorization: Bearer ${SABFLOW_INTERNAL_TOKEN}` and reject anything else.

## Notes

- `npm install` runs **inside this service directory only** — deps are **not** added to the repo-root `package.json` (per Track B scope).
- The skeleton uses `imapflow` (modern, IDLE-aware, native ESM) and `mailparser` for RFC 822 parsing.
- The PM2 manifest for this service is added by sub-task #4 of Track B Phase 6; this sub-task only ships the worker skeleton.
