# SabNode → Rust Backend Migration Plan

> Status: **draft** · Owner: TBD · Last updated: 2026-05-04

Migrate the SabNode backend from Next.js Server Actions + Node workers to a
Rust service. Next.js stays as the frontend (RSC + client) and acts as a thin
BFF/proxy.

---

## 1. Scope reality

| Surface                          | Count                  | Notes                          |
| -------------------------------- | ---------------------- | ------------------------------ |
| Server Action files              | **117**                | ~113 use `'use server'`        |
| Estimated action functions       | **~1,000–1,400**       | e.g. `whatsapp.actions.ts`: 45 |
| API route handlers (`route.ts`)  | **111**                | Webhooks, OAuth callbacks, v1  |
| PM2 workers (Node)               | **15+**                | Broadcast cluster + 11 SEO     |
| BullMQ queues                    | **multiple**           | Broadcast, SEO, durable jobs   |
| External integrations            | Mongo, Redis, Firebase, Meta/WhatsApp, Razorpay, PayU, GSC, n8n, Genkit AI, Sentry, OTel | |

**Total endpoint surface ≈ 1,200–1,600 functions.** A full rewrite is realistically
**9–14 months** of one experienced Rust engineer's full-time work, longer with
parallel feature development. Plan accordingly.

---

## 2. Target architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Browser (RSC + client)                    │
└───────────────────────────────┬──────────────────────────────────┘
                                │ HTTPS, session cookie
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  Next.js 16 (BFF / proxy)                                         │
│  - Pages, layouts, RSC                                            │
│  - NextAuth login → issues short-lived JWT                        │
│  - Server Actions become thin `fetch()` wrappers around Rust      │
│  - Webhook receivers stay here ONLY if Vercel-hosted; else moved  │
└───────────────────────────────┬──────────────────────────────────┘
                                │ HTTPS, JWT (Bearer)
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  sabnode-api (Rust, Axum)         ┌───────────────┐               │
│  - REST + (optional) gRPC         │  Rust workers │  ← BullMQ /   │
│  - Auth middleware (JWT verify)   │  (Tokio)      │    Redis      │
│  - Tenant/RBAC guard              └───────┬───────┘    Streams    │
│  - Modules: wachat, sabflow, crm, ..      │                       │
└──────┬─────────────┬──────────────────────┴───────────────────────┘
       │             │
       ▼             ▼
   MongoDB        Redis (cache + queue)
       │             │
       └── Firebase (FCM/Auth via REST), Meta API, Razorpay, etc.
```

### Decisions (defaults — confirm or override)

| Decision               | Default                                             | Why                                                                    |
| ---------------------- | --------------------------------------------------- | ---------------------------------------------------------------------- |
| Web framework          | **Axum** (Tokio)                                    | Largest ecosystem, async-first, towers compose cleanly                 |
| ORM / DB driver        | **`mongodb` crate** (official) + `bson`             | Aligns with current driver; no schema migration needed                 |
| Redis                  | **`fred`** (or `redis-rs` + `bb8`)                  | `fred` has better cluster + pubsub ergonomics                          |
| Queue                  | **Keep BullMQ** initially, port queue producers to Rust via `bullmq-rs`-equivalent | BullMQ is JS-native; reimplement protocol or move to Redis Streams in phase 4 |
| Auth                   | **NextAuth stays in Next.js** → issues HS256/RS256 JWT, Rust verifies | Smallest blast radius; admin-session.ts also issues JWT                |
| Service shape          | **Cargo workspace**, one binary, modules as crates  | `crates/{auth, wachat, sabflow, crm, seo, sabchat, sms, ad-manager, billing, common}` |
| Transport              | **REST/JSON** (mirror current action signatures)    | gRPC adds toolchain pain for the BFF; revisit later                    |
| OpenAPI                | **`utoipa`** generates spec → typed TS client       | Killer feature for the BFF migration                                   |
| Errors                 | **`thiserror`** + central `ApiError` → JSON         | Standard                                                               |
| Validation             | **`validator`** + serde                             | Standard                                                               |
| Observability          | **`tracing`** + OTel exporter → existing collector  | Reuse Sentry/OTel infra                                                |
| Config                 | **`figment`** (env + file)                          | Plays well with multi-env                                              |
| Tests                  | **`cargo test`** + **`testcontainers`** for Mongo/Redis | Real integration tests, not mocks                                      |
| Deployment             | **Docker on existing VPS** (or Fly.io)              | Vercel cannot host Rust services; ship behind nginx with mTLS to Next  |
| Rust edition / MSRV    | **2024 edition**, MSRV = stable                     |                                                                        |

### Open decisions (need your call)

1. **Firebase scope** — confirm which Firebase features are in use. `src/lib/firebase/config.ts` exists; if it's only push/Auth, both can be hit via REST. **If Firestore is used, that's painful** (no good Rust SDK).
2. **Webhooks** — keep Meta/Razorpay webhook receivers in Next.js (low effort) or move to Rust (better latency)?
3. **Genkit AI** (`@genkit-ai/googleai`) — keep AI in a Node sidecar, or port to Rust via `async-openai`/Vertex REST?
4. **gRPC?** Adds value if Rust will call Rust later; not now.

---

## 3. Phased plan

Strangler-fig: stand up Rust alongside Next.js, route one module at a time
behind a feature flag, delete the Node action only after the Rust endpoint
has run in prod for ≥1 week with parity.

### Phase 0 — Foundations (2–3 weeks)

**Goal:** Rust service in production handling one trivial endpoint end-to-end.

- [ ] Cargo workspace scaffold: `crates/{api,common,auth,db,observability}`
- [ ] Axum server, health + readiness endpoints
- [ ] `mongodb` + `fred` (Redis) clients with shared connection pools
- [ ] JWT middleware: verify token issued by Next.js (HS256, shared secret rotated via env)
- [ ] Tenant + RBAC guard extractor (mirrors `rbac-server.ts`)
- [ ] Central error type → JSON `{ ok: false, error: { code, message } }`
- [ ] Tracing + OTel exporter wired to current collector
- [ ] OpenAPI generator (`utoipa`) → emits `openapi.json` at build time
- [ ] `scripts/gen-rust-client.ts` — generates a typed TS client into `src/lib/rust-client/`
- [ ] Dockerfile, GitHub Action to build + push, deploy to staging VPS
- [ ] **Pilot endpoint:** port `GET /api/v1/health` from Next.js to Rust, route Next call through

**Exit criteria:** Rust service serving prod traffic for one trivial route; CI/CD green.

### Phase 1 — Hot-path migration (4–6 weeks)

**Why first:** these are the highest-throughput actions where Rust pays off most.

- [ ] `webhook.actions.ts` + `src/app/api/webhooks/meta/route.ts` (Meta webhook ingest)
- [ ] `whatsapp.actions.ts` (45 functions — split into send / template / media subcrates)
- [ ] `broadcast.actions.ts` (11 functions)
- [ ] `send-template.actions.ts`
- [ ] **Broadcast worker** (Rust + Tokio + BullMQ Redis protocol or Redis Streams replacement)
- [ ] Rate-limit / token-bucket for Meta API in Rust (currently `src/lib/api-platform/rate-limit.ts`)

For each action: write the Rust handler, regenerate TS client, replace Next.js
action body with `await rustClient.x(...)` (keep `'use server'` so call sites
don't change), feature-flag the cutover per project.

**Exit criteria:** WhatsApp send pipeline 100% on Rust; Node broadcast worker
kept warm but not consuming.

### Phase 2 — CRM module (8–12 weeks)

54 CRM action files. Largest single chunk. Port one sub-module per week:

- accounting, accounts, analytics, auto-leads, automations, credit-notes, deals,
  debit-notes, delivery-challans, email, email-templates, employees, expenses,
  forms, hr, hr-appraisals, hr-reports, integrations, inventory, inventory-settings,
  invoices, leads, leads-api, payment-accounts, payment-receipts, payouts, payroll,
  pipelines, products, proforma-invoices, purchase-orders, quotations, reconciliation,
  reports, roles, sales-orders, services, settings, tasks, vendors, vouchers, warehouses

CRM is mostly CRUD → ideal Rust + Axum + serde fit. Build a generator macro for
the repetitive `list / get / create / update / delete` shape.

**Exit criteria:** All CRM Server Actions are pass-throughs to Rust; Mongo writes
100% from Rust; old code paths deleted.

### Phase 3 — SEO + SabFlow + SabChat + SMS + Ad Manager (6–8 weeks)

- [ ] SEO (`seo-*.actions.ts` × 7) + 7 SEO workers → Rust (Tokio scheduler replaces tsx workers)
- [ ] SabFlow (`sabflow.actions.ts`, `sabflow-results.ts`, `sabflow/`) — flow execution engine
- [ ] SabChat (`sabchat.actions.ts`)
- [ ] SMS suite (8 files)
- [ ] Ad Manager (3 files)

**Risk:** SabFlow is a runtime engine, not CRUD. Likely needs a dedicated
sub-design before porting.

### Phase 4 — Remaining + cleanup (4–6 weeks)

- [ ] Remaining ~25 action files (billing, calling, catalog, integrations, etc.)
- [ ] OAuth callbacks (`src/app/auth/facebook/callback/...`) — keep in Next.js, just call Rust
- [ ] Move BullMQ jobs to native Redis Streams (drops Node dependency from queue layer)
- [ ] Decommission Node workers
- [ ] Remove `src/app/actions/*` files entirely; `src/lib/rust-client/` becomes the only backend surface
- [ ] PM2 ecosystem reduced to just `sabnode-web`
- [ ] Auth: optionally move login itself into Rust (NextAuth → Rust auth service)

### Phase 5 — Hardening (ongoing)

- [ ] Load testing (`k6`) on broadcast send + webhook ingest
- [ ] SLOs in OTel: p95 latency per endpoint
- [ ] Disaster-recovery runbook (Rust crash → Next.js fallback to read-only mode)
- [ ] Security review of JWT handling, tenant isolation, RBAC enforcement

---

## 4. Migration recipe (per action file)

Repeatable checklist — apply to each `*.actions.ts`:

1. **Read** the action file. List every exported function, its inputs, outputs,
   side effects (DB writes, external calls, cache invalidations).
2. **Write Rust handler** in the matching crate. Use `utoipa` annotations.
3. **Add integration test** with `testcontainers` (real Mongo/Redis).
4. **Regenerate TS client** (`pnpm gen:rust-client`).
5. **Rewrite the Next.js action** as a thin wrapper:
   ```ts
   'use server';
   import { rustClient } from '@/lib/rust-client';
   export async function getContacts(projectId: string) {
     return rustClient.contacts.list({ projectId });
   }
   ```
6. **Feature flag** (`USE_RUST_CONTACTS`) — read from env / Edge Config, default off.
7. **Shadow traffic for 24h** — call both, compare results, log diffs.
8. **Cutover** per-tenant, then global.
9. **Delete** old Node implementation after 1 week of green metrics.

---

## 5. Risk register

| Risk                                                                   | Mitigation                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **BullMQ protocol is not officially supported in Rust**                | Phase 1: keep BullMQ workers in Node, Rust enqueues only. Phase 4: migrate to Redis Streams. |
| **Firestore (if used)** has no production-grade Rust SDK               | Confirm scope; wrap REST + service-account JWT manually             |
| **Genkit AI** is JS-only                                               | Keep AI in a Node sidecar called by Rust over HTTP                  |
| **NextAuth session ↔ Rust JWT mismatch**                               | Single signing key in env; Next.js issues, Rust verifies; rotate quarterly |
| **Schema drift** between Mongo collections and Rust BSON structs       | Generate structs from a JSON-schema source-of-truth; CI check       |
| **Throughput regression during cutover**                               | Shadow traffic + per-tenant flag; rollback = flip flag              |
| **Vercel deployment** can't host Rust                                  | Keep Next.js on Vercel, Rust on VPS/Fly; use Vercel Routing Middleware to add auth headers if needed |
| **117 files is a lot** — team boredom / scope creep                    | Strict per-week file budget; no "while I'm here" refactors          |

---

## 6. Success metrics

- p95 latency on `whatsapp.send` ↓ ≥ 30%
- Memory footprint ↓ ≥ 50% per worker process
- Mongo connection count ↓ (Rust pool + Tokio = fewer connections)
- Zero increase in 5xx rate during cutover (shadow + flag)
- Active CPU time billed ↓ on the Node process (Vercel Functions metric)

---

## 7. What I need from you to start

1. **Confirm framework** = Axum.
2. **Confirm auth strategy** = NextAuth issues JWT, Rust verifies (no login move yet).
3. **Confirm deployment target** for the Rust service (VPS? Fly.io? Railway?).
4. **Firebase usage scope** (FCM only? Auth? Firestore?).
5. **Headcount** — solo or team? Affects timeline by 3-4×.
6. **Approve Phase 0 scope** so I can scaffold the workspace.

Once those six answers land, Phase 0 starts.
