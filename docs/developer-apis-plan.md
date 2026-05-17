# Developer APIs — Full Build Plan

Owner: ratansingh111786a@gmail.com
Created: 2026-05-17
Status: Draft v1 — pending approval before phase 0 starts

---

## 1. Goal

Ship a complete, production-grade **Developer Platform** on top of SabNode so any external developer can do everything a logged-in tenant can do via HTTP. Concretely:

- Cover **every module** in `/dashboard/*` **except SabFlow** with a `v1/` REST surface (~244 action files, ~120 Rust crates).
- Support **API keys, OAuth2, Personal Access Tokens, and outbound HMAC webhooks** as four first-class auth/eventing surfaces.
- Ship **TypeScript + Python SDKs**, an **interactive sandbox**, a **webhook subscriptions UI**, and **per-key usage analytics + quotas**.
- Be the foundation for the existing **Marketplace** (`/api/v1/marketplace/*`) so third-party apps can install on a tenant.

### Non-goals

- **SabFlow** is intentionally excluded from the developer-API surface. SabFlow is the workflow/automation engine — developers integrate **with** it via triggers, webhooks, and HTTP nodes inside flows, not by driving its CRUD over the public API. Existing `/api/v1/flows/[id]/run` and `/api/v1/agents/[id]/run` stay as-is (they are run-only triggers, not management endpoints) and are *not* expanded.
- GraphQL (REST + OpenAPI only for v1).
- Anonymous/public endpoints beyond the existing `/api/v1` discovery and `/api/v1/openapi`.
- Replacing the internal server actions used by the dashboard — the developer API is a **parallel transport** on top of the same domain logic.

---

## 2. Current state (do not re-build)

| Area | Where | Notes |
|---|---|---|
| Discovery | `src/app/api/v1/route.ts` | Returns version + docs_url. |
| Auth platform | `src/lib/api-platform/*` | `verifyApiKey`, `requireScope`, `consumeToken`, `rateLimitHeaders`, tier system. Extend, don't replace. |
| Key storage | Rust crate `wachat-api-keys-admin` + `wachat-public-api` | SHA-256 hashed at rest. Bytes-compatible between admin generator and inbound verifier. |
| Dashboard | `src/app/dashboard/api-keys/page.tsx`, `src/app/dashboard/api/docs/page.tsx` | Will be reorganized under a single `/dashboard/api/*` parent. |
| Docs page | `src/app/api/docs/page.tsx` | Public-facing developer landing. Keep + redesign. |
| OpenAPI | `src/app/api/v1/openapi/route.ts` | Will be auto-generated from a manifest (see §11). |
| Existing v1 routes | `src/app/api/v1/*` | ~24 hand-written endpoints across `me`, `messages`, `broadcasts`, `sms`, `contacts`, `projects`, `templates`, `marketplace`, `crm/leads`, `seo`, `billing`, `agents`, `wachat`, `flows`. Will be folded into the generated set. |
| Marketplace | `/api/v1/marketplace/installs`, `/api/v1/marketplace/usage` | Already exists — OAuth2 layer below will plug into this. |
| Legacy stub | `authenticateApiKey()` in `src/app/actions/api-keys.actions.ts` | Stays as a 401-always shim until last hand-written route is migrated, then deleted. |

---

## 3. Architecture

### 3.1 Layered model

```
HTTP client
   │
   ▼
src/app/api/v1/<module>/<resource>/route.ts          ← thin handler (generated)
   │   ├── verifyApiKey() | verifyOAuthToken() | verifyPAT()
   │   ├── requireScope(<scope>)
   │   ├── consumeToken(rateLimitKey, tier)         ← Redis
   │   ├── enforceQuota(key, endpoint)              ← Mongo counter
   │   ├── enforceRBAC(user, key, action)           ← only for PAT/OAuth user-scoped
   │   ├── chargeCredits(action)                    ← existing credit-usage pipeline
   │   └── delegate → existing server action / Rust crate
   ▼
Existing business logic (unchanged)
   │
   ▼
Outbound: webhook dispatcher (new) ← writes to BullMQ-style queue, signed delivery
```

**Key invariant:** v1 handlers are *adapters*. They never contain domain logic. Domain logic lives in actions/Rust crates and is shared with the dashboard.

### 3.2 Versioning

- Path: `/api/v1/...` — additive only. Breaking changes go to `/api/v2/`.
- Deprecation: `Deprecation: true` + `Sunset: <RFC1123>` headers, plus a `warnings[]` field in JSON response envelope.
- Beta endpoints under `/api/v1/beta/...` with no SLA.

### 3.3 Response envelope

```json
{
  "data": { ... } | [ ... ],
  "meta": { "request_id": "req_…", "tenant_id": "…", "tier": "pro" },
  "pagination": { "cursor": "…", "has_more": true } | null,
  "warnings": []
}
```

Errors:

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Rate limit exceeded. Retry after 13s.",
    "doc_url": "/api/docs/errors#rate_limited",
    "request_id": "req_…"
  }
}
```

Standardize codes: `auth_invalid`, `auth_missing`, `scope_missing`, `rate_limited`, `quota_exceeded`, `validation_failed`, `not_found`, `conflict`, `credits_insufficient`, `internal_error`.

---

## 4. Auth & identity

### 4.1 API keys (extend existing)

- **Format:** `sab_live_<32-hex>` (prefix denotes env: `sab_live_` / `sab_test_`). Currently keys are opaque — adding the prefix is non-breaking because we only hash the suffix.
- **Scopes:** add scope strings to the key record (see §4.5). Default new keys to `*` for backward compat; UI nudges users to scope down.
- **Tiers** (already in `api-platform`): `free`, `starter`, `pro`, `business`, `enterprise` — different per-second + per-day quotas.
- **Storage:** existing Rust crate. Add columns: `scopes Vec<String>`, `env "live"|"test"`, `expires_at Option<DateTime>`, `last_used_ip String`, `created_by_user_id String`.

### 4.2 Personal Access Tokens (PAT)

- Same on-the-wire format (`sab_pat_<…>`), different verifier path.
- Bound to **a specific user inside a tenant**, so calls go through the same RBAC as the dashboard.
- New Rust crate: `wachat-personal-tokens` (mirror of `wachat-api-keys-admin`).
- UI: `/dashboard/api/personal-tokens`.

### 4.3 OAuth2 (third-party apps)

- New Rust crate: `oauth-server` (or extend `wachat-api-keys-admin`).
- Flows: **Authorization Code + PKCE** (no implicit, no password grant).
- Endpoints:
  - `GET  /api/oauth/authorize` — Next.js page that renders a consent screen against the requested scopes.
  - `POST /api/oauth/token` — exchange code → access_token (+ refresh_token).
  - `POST /api/oauth/revoke`
  - `POST /api/oauth/introspect` (RFC 7662, for internal use)
- **App registration UI:** `/dashboard/api/apps` (developer creates the app, gets `client_id` / `client_secret`, sets redirect URIs, requested scopes).
- **Marketplace tie-in:** an installed Marketplace app *is* a registered OAuth app with auto-granted scopes. Existing `/api/v1/marketplace/installs` becomes the install endpoint that creates the OAuth grant.

### 4.4 Outbound HMAC webhooks

- Header: `X-SabNode-Signature: t=<ts>,v1=<hex_hmac_sha256>`
- Secret: per-subscription, rotatable, shown once at creation.
- Replay protection: signature includes timestamp; receivers reject if `|now - t| > 300s`.
- Delivery: BullMQ on Redis. Retries `0s, 30s, 5m, 1h, 6h, 24h` (6 attempts). After 6, mark `failed` and pause subscription if 50+ consecutive failures.
- Event taxonomy: `<module>.<resource>.<verb>` — e.g. `crm.lead.created`, `wachat.message.received`, `sabflow.run.completed`. Initial catalog ≈ 80 events.

### 4.5 Scope namespace

```
me:read
keys:read keys:write
contacts:read contacts:write
wachat:messages:send  wachat:messages:read  wachat:templates:write …
sabwa:* sabflow:* sabchat:* sabfiles:* sms:* email:* telegram:* …
crm:leads:read crm:leads:write crm:deals:* crm:invoices:* crm:hr:* …
seo:audit  seo:rank  seo:ai
webhooks:read webhooks:write
billing:read   ← read-only on usage/credits
admin:*        ← reserved, never granted to external apps
```

Wildcards allowed: `crm:*`, `wachat:messages:*`, `*`.

---

## 5. Endpoint inventory (target: ~500 endpoints)

The full inventory is too large for this doc — it will live in `docs/developer-apis-inventory.md`, generated from the manifest (§11). Below is the **per-module summary** with rough endpoint counts so we can size phases.

| Module group | Source actions | ~Endpoints | Notes |
|---|---|--:|---|
| **Identity / keys** | `api-keys`, `user`, `team`, `account`, `rbac`, `plan` | 25 | `/me`, `/keys`, `/team/members`, `/plans`, `/rbac/roles` |
| **WhatsApp Cloud (Wachat)** | `whatsapp`, `whatsapp-analytics`, `whatsapp-pay`, `template`, `send-template`, `broadcast`, `wachat-features` | 45 | Messages, templates, broadcasts, analytics, pay, flows |
| **SabWa (personal WA)** | `sabwa` | 25 | Sessions, messages, contacts, status, QR auth |
| ~~SabFlow~~ | — | **0** | **EXCLUDED.** Workflow engine — developers integrate via triggers/webhooks/HTTP nodes inside flows, not by driving its CRUD. Existing `/api/v1/flows/[id]/run` stays as a trigger-only entry point. |
| **SabFiles** | `files`, `sabfiles` | 18 | List/upload/copy/share — must respect SabFiles policy (no external URLs) |
| **SabChat** | `sabchat`, `sabchat-settings` | 22 | Bots, conversations, messages, deploy targets |
| **SMS** | `sms`, `sms-*` | 22 | Send, templates, campaigns, logs, analytics, config |
| **Email** | `email`, `crm-email`, `crm-email-templates` | 18 | Send, templates, inbox sync |
| **Telegram** | 18 telegram action files | 35 | Bot, channels, broadcasts, payments, stories, stickers, flows, webhooks |
| **Facebook/Instagram/Meta Suite** | `facebook*`, `instagram*`, `meta-*` | 30 | Pages, posts, comments, DMs, albums, ad insights bridge |
| **Ad Manager** | `ad-manager*` | 18 | Campaigns, ad sets, ads, audiences, insights |
| **CRM — Core** | `crm`, `crm-leads*`, `crm-deals`, `crm-pipelines`, `crm-contacts`, `crm-accounts`, `crm-custom-fields`, `crm-saved-views`, `crm-labels` | 55 | Leads, deals, contacts, companies, custom fields, pipelines, lookup |
| **CRM — Sales & ops** | `crm-quotations`, `crm-invoices`, `crm-proforma-invoices`, `crm-credit-notes`, `crm-debit-notes*`, `crm-sales-orders`, `crm-purchase-orders`, `crm-rfq`, `crm-estimate-*`, `crm-delivery-challans`, `crm-coupons`, `crm-gift-cards`, `crm-loyalty*`, `crm-subscriptions`, `crm-service-contracts`, `crm-contracts*` | 70 | Full sales+procurement |
| **CRM — Inventory** | `crm-inventory*`, `crm-items`, `crm-item-batches`, `crm-warehouses`, `crm-stock-adjustments`, `crm-bom`, `crm-grns`, `crm-production-orders`, `crm-vendors`, `crm-vendor-bids*`, `crm-vendor-types`, `crm-brands`, `crm-product-categories`, `crm-fixed-assets` | 50 | Stock + manufacturing |
| **CRM — Accounting** | `crm-accounting*`, `crm-chart-of-accounts`, `crm-bank-transactions`, `crm-payment-*`, `crm-payouts*`, `crm-bills`, `crm-budgets`, `crm-petty-cash`, `crm-reconciliation`, `crm-vouchers`, `crm-expenses`, `crm-expense-*`, `crm-currencies`, `crm-tds`, `crm-tax`, reports | 50 | Books of accounts + reports |
| **CRM — HR / HRM** | `crm-hr*`, `crm-employees`, `crm-candidates`, `crm-hire`, `crm-interviews`, `crm-jobs`, `crm-offers`, `crm-onboarding`, `crm-payroll*`, `crm-payslips`, `crm-leave*`, `crm-leave-balances`, `crm-attendance`, `crm-shifts`, `crm-shift-rotations`, `crm-time-logs`, `crm-timesheets`, `crm-policies`, `crm-disciplinary`, `crm-exits`, `crm-notices`, `crm-loans`, `crm-emergency-contacts`, `crm-visa-details`, `crm-asset-assignments`, `crm-form-16`, `crm-welcome-kits`, `crm-compensation-bands`, `crm-salary-structures`, `crm-pt-slabs` | 80 | Full HRM stack |
| **CRM — Performance** | `crm-appraisals`, `crm-hr-appraisals`, `crm-feedback-360`, `crm-goals`, `crm-okrs`, `crm-kpis`, `crm-one-on-ones`, `crm-succession`, `crm-training`, `crm-learning-paths`, `crm-certifications`, `crm-awards` | 35 | Reviews + growth |
| **CRM — Projects** | `crm-jobs` (project tasks lives separately), `crm-project-categories`, `crm-project-tasks`, `crm-subtasks`, `crm-milestones`, `crm-events`, `crm-travel`, `crm-issues`, `crm-tasks`, `crm-tickets`, `crm-ticket-groups`, `crm-agent-groups`, `crm-slas` | 45 | PM + ticketing |
| **CRM — Knowledge / portal / docs / forms** | `crm-knowledge-base`, `crm-kb-articles`, `crm-documents`, `crm-document-templates`, `crm-contract-templates`, `crm-contract-types`, `crm-forms`, `crm-form-submissions`, `crm-careers-pages`, `crm-portal-users`, `crm-announcements`, `crm-dashboards`, `crm-analytics`, `crm-reports-*`, `crm-bulk-import` | 35 | Content + analytics |
| **SEO tools** | `seo*` | 20 | Audit, GSC, rank, mesh, indexing, AI helpers |
| **Notifications** | `notification` | 8 | Send, subscriptions, preferences |
| **URL shortener / QR** | `url-shortener`, `qr-code` | 10 | CRUD links + QR generation |
| **E-commerce / Shop** | `custom-ecommerce*`, `catalog` | 18 | Storefront read API + order ingest |
| **Calling** | `calling` | 8 | Initiate, list, recording fetch |
| **Sign / Documents** | (`/api/sign/*` exists today) | 8 | Send for signature, status, fetch signed |
| **Integrations / n8n** | `integrations`, `n8n` | 8 | Connection list, trigger inbound |
| **Billing / credits / usage** | `billing`, `plan`, credit-usage | 10 | Read-only — invoices, credit balance, plan limits |
| **Webhooks (control plane)** | new | 8 | Subscriptions CRUD + deliveries list + retry |
| **OAuth / apps (control plane)** | new | 12 | App CRUD + grants + revoke |
| **Admin / SCIM** | `/api/scim/*` exists | 12 | User provisioning for enterprise — already partially there |
| **Total target** | | **~795** | (SabFlow excluded) — will likely settle ~480–580 after dedupe |

---

## 6. Codegen — the leverage layer

Hand-writing 500+ route handlers is a non-starter. Build a **manifest-driven generator**.

### 6.1 Manifest

`tools/api-manifest/index.ts` exports an array of `EndpointSpec`:

```ts
type EndpointSpec = {
  module: 'crm' | 'wachat' | 'sabwa' | …;
  resource: string;           // e.g. 'leads'
  verb: 'list'|'get'|'create'|'update'|'delete'|'custom';
  path: string;               // e.g. '/crm/leads' or '/crm/leads/{id}/merge'
  method: 'GET'|'POST'|'PATCH'|'DELETE';
  scope: string | string[];
  tier: 'free'|'starter'|'pro'|'business'|'enterprise';
  credits?: number;           // charges on success
  delegate:                   // exactly one
    | { kind: 'action'; module: string; export: string }
    | { kind: 'rust'; client: string; method: string };
  input: ZodSchema;
  output: ZodSchema;
  webhookEvents?: string[];   // emitted on success
  rbac?: { permission: string }; // only for PAT/OAuth user-scoped calls
};
```

### 6.2 Generated artifacts (all in `_generated/`, gitignored where appropriate)

1. `src/app/api/v1/**/route.ts` — one handler per spec, all identical structure.
2. `src/app/api/v1/openapi/openapi.json` — full OpenAPI 3.1 doc.
3. `sdks/typescript/src/_generated/` — typed TS SDK (axios-based, supports streaming).
4. `sdks/python/sabnode/_generated/` — Python SDK.
5. `docs/developer-apis-inventory.md` — human-readable table for the docs site.
6. `src/lib/api-platform/_generated/scopes.ts` — exhaustive scope union for type-safe `requireScope` calls.
7. `src/lib/api-platform/_generated/events.ts` — webhook event enum.

### 6.3 Generator workflow

```
pnpm api:gen          # full regen, runs on prebuild + in CI
pnpm api:gen --diff   # show what would change without writing
pnpm api:lint         # validate manifest (no duplicate paths, scopes match enum, etc.)
```

CI fails if a hand-edited file under `src/app/api/v1/**` is committed without a corresponding manifest change.

---

## 7. Rate limiting, quotas, billing

| Layer | Purpose | Where |
|---|---|---|
| Per-key token bucket | Burst protection | Existing `consumeToken` in `api-platform` — extend with per-endpoint cost. |
| Per-day quota | Plan-based cap (e.g. free = 10k req/day) | New: `lib/api-platform/quota.ts`, Mongo counter `apiUsageDaily`. |
| Per-endpoint cost | Heavier endpoints (bulk send, PDF reports) cost N tokens | Field on `EndpointSpec`. |
| Credit charge | Reuses existing credit-usage pipeline | Field on `EndpointSpec`. |
| Concurrent connection limit | Prevents tenant from holding 1000 streams | New, Redis `INCR/DECR` around handler. |

Headers on every response:
`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-Quota-Limit`, `X-Quota-Remaining`, `X-Request-Id`, `X-API-Version`.

---

## 8. Webhooks

### 8.1 Data model (Mongo)

- `webhook_subscriptions`: `{ _id, tenantId, url, events: string[], secretHash, status: 'active'|'paused'|'failed', createdAt, lastDeliveryAt }`
- `webhook_deliveries`: `{ _id, subscriptionId, event, payloadHash, attempts: [{ ts, statusCode, error }], status: 'pending'|'success'|'failed', nextAttemptAt }`

### 8.2 Dispatcher

- Producer: every action that emits a webhook event calls `emitWebhook(tenantId, event, payload)`. Mongo-side change-stream OR direct call — pick after measuring; default to direct call inside the v1 handler so we have a single emission point.
- Worker: PM2 process `webhook-worker` running BullMQ on Redis. Retries per §4.4.
- Idempotency: each delivery has an `Idempotency-Key` header so receivers can dedupe.

### 8.3 UI

- `/dashboard/api/webhooks` — list subscriptions, create/edit, test-fire button, view recent deliveries with payload + response, retry button.

---

## 9. Developer dashboard reorg

Single parent `/dashboard/api/*`:

```
/dashboard/api               → overview (quickstart, key recent activity)
/dashboard/api/keys          → API keys CRUD (replaces /dashboard/api-keys)
/dashboard/api/personal-tokens → PAT CRUD
/dashboard/api/apps          → OAuth apps CRUD
/dashboard/api/webhooks      → subscriptions + delivery log
/dashboard/api/usage         → per-key analytics, top endpoints, error rates
/dashboard/api/logs          → request log explorer (last 30 days)
/dashboard/api/docs          → interactive sandbox (Scalar UI)
/dashboard/api/changelog     → API changelog + deprecation notices
```

Old `/dashboard/api-keys` redirects to `/dashboard/api/keys`.

Public-facing:
- `/api/docs` (already exists) — landing + auth guide + module index + SDK install snippets.
- `/api/docs/<module>` — per-module reference (rendered from OpenAPI).

---

## 10. Sandbox & testing

- **Test environment:** keys prefixed `sab_test_` operate against a tenant flag `apiTestMode: true`. Test-mode keys can hit every endpoint but:
  - WhatsApp/SMS/Email sends route through a stub adapter that logs but does not transmit.
  - Webhooks deliver to a special inbox viewable in `/dashboard/api/sandbox/inbox`.
  - Credits are not charged.
- **Inspector:** Scalar (or Stoplight Elements) on `/dashboard/api/docs` with the user's `sab_test_*` key pre-filled.
- **Request log explorer:** every API request (live + test) writes a row to `apiRequestLog` (TTL 30 days). Searchable by endpoint, status, key, request_id.

---

## 11. Observability

- Metric tags: `tenant_id`, `key_id`, `endpoint`, `module`, `status`, `tier`.
- Counters: `api_requests_total`, `api_errors_total`, `api_rate_limited_total`, `webhook_deliveries_total`, `webhook_failures_total`.
- Histograms: `api_latency_ms`, `webhook_attempt_latency_ms`.
- Per-request log: `request_id`, `tenant_id`, `key_id`, `endpoint`, `method`, `status`, `latency_ms`, `bytes_in`, `bytes_out`, `ua`, `ip`.

---

## 12. Phased rollout

Each phase is independently shippable. Stop and ship between phases — do not let this become a 6-month branch.

### Phase 0 — Foundations (1 week)
- Stand up the manifest + generator skeleton with **5 sample endpoints** ported from existing hand-written routes.
- Generated OpenAPI replaces the current static-ish one.
- Response envelope + error model standardized.
- Per-endpoint scope + cost fields wired to `api-platform`.
- Tests: contract tests (input/output schema), one per generated route.
- Deliverables: `tools/api-manifest/`, `tools/api-codegen/`, `pnpm api:gen`, `pnpm api:lint`.

### Phase 1 — Identity & keys (3–4 days)
- API keys gain `scopes`, `env`, `expires_at`, `created_by_user_id` (Rust crate + Next.js UI).
- New `/dashboard/api/keys` (port from `/dashboard/api-keys`, redirect old path).
- PAT crate + UI.
- `me`, `keys`, `personal-tokens`, `team`, `account`, `plans`, `rbac/roles` modules through codegen.

### Phase 2 — Messaging core (1 week)
- Wachat (full), SabWa, SMS, Email, Telegram (bot + channels).
- These are the highest-demand endpoints — ship them first to validate the codegen.

### Phase 3 — Contacts, files, chat (1 week)
- Contacts, SabFiles, SabChat, Notifications. (**SabFlow excluded** — see §1 non-goals.)
- **SabFiles policy must be enforced:** developer file inputs require a SabFile reference or upload, never an external URL (mirror the picker rule).

### Phase 4 — CRM core (2 weeks)
- Leads, deals, pipelines, contacts, companies, custom fields, saved views, labels, lookup.
- HRM (employees, candidates, hiring funnel, attendance, leave, payroll).

### Phase 5 — CRM sales/inventory/accounting (2 weeks)
- Quotations → invoices → payments → receipts.
- Inventory + procurement + manufacturing.
- Accounting + reports.

### Phase 6 — CRM performance + projects + content (1 week)
- Appraisals, goals, OKRs, KPIs, learning.
- Project tasks, milestones, tickets, SLAs.
- Knowledge base, forms, documents, careers pages.

### Phase 7 — Marketing & social (1 week)
- Facebook, Instagram, Meta Suite, Ad Manager.
- SEO suite, URL shortener, QR.

### Phase 8 — Webhooks (1 week)
- Dispatcher, worker, retries, subscription CRUD, delivery log UI.
- Emit hooks from already-generated endpoints by populating `webhookEvents` in the manifest.

### Phase 9 — OAuth2 + Marketplace tie-in (1.5 weeks)
- `oauth-server` crate, authorize/token/revoke/introspect endpoints.
- App registration UI.
- Marketplace install path creates OAuth grants.

### Phase 10 — SDKs + interactive docs (1 week)
- TS SDK generation + publish to npm (`@sabnode/sdk`).
- Python SDK generation + publish to PyPI (`sabnode`).
- Scalar embedded on `/dashboard/api/docs` and `/api/docs`.
- Examples repo: `sabnode-examples`.

### Phase 11 — Usage analytics + quotas + sandbox (1 week)
- `apiUsageDaily` aggregation pipeline + UI.
- `/dashboard/api/usage`, `/dashboard/api/logs`, `/dashboard/api/sandbox/inbox`.
- Test-mode adapters for WA/SMS/email.

**Total elapsed:** ~12–14 working weeks. With two engineers and codegen doing the boring work, achievable.

---

## 13. File map (new + modified)

```
docs/
  developer-apis-plan.md                    ← this file
  developer-apis-inventory.md               ← GENERATED

tools/
  api-manifest/
    index.ts                                ← imports per-module specs
    modules/
      identity.ts wachat.ts sabwa.ts crm-core.ts crm-sales.ts …
    types.ts schemas.ts events.ts
  api-codegen/
    generate-routes.ts
    generate-openapi.ts
    generate-ts-sdk.ts
    generate-python-sdk.ts
    generate-inventory.ts
    lint-manifest.ts

src/app/api/v1/                             ← REGENERATED (route.ts files)
src/app/api/v1/openapi/openapi.json         ← GENERATED
src/app/api/oauth/
  authorize/route.ts  token/route.ts  revoke/route.ts  introspect/route.ts
src/app/api/webhooks/                       ← outbound delivery callbacks live here too
  test/route.ts

src/app/dashboard/api/
  page.tsx
  keys/page.tsx
  personal-tokens/page.tsx
  apps/page.tsx  apps/[appId]/page.tsx
  webhooks/page.tsx  webhooks/[subId]/page.tsx
  usage/page.tsx
  logs/page.tsx
  docs/page.tsx
  changelog/page.tsx
  sandbox/inbox/page.tsx

src/lib/api-platform/
  verify-api-key.ts                         ← existing, extend
  verify-oauth.ts                           ← NEW
  verify-pat.ts                             ← NEW
  rate-limit.ts                             ← existing
  quota.ts                                  ← NEW
  envelope.ts                               ← NEW (response/error helpers)
  emit-webhook.ts                           ← NEW
  _generated/scopes.ts events.ts            ← GENERATED

src/app/actions/
  webhook.actions.ts                        ← existing, extend for subscriptions UI
  developer-apps.actions.ts                 ← NEW

rust/crates/
  wachat-api-keys-admin/                    ← existing, extend (scopes, env, expiry)
  wachat-public-api/                        ← existing, extend (oauth + PAT verifier)
  wachat-personal-tokens/                   ← NEW
  oauth-server/                             ← NEW
  webhook-dispatcher/                       ← NEW (PM2 worker)

sdks/
  typescript/                               ← published as @sabnode/sdk
  python/                                   ← published as sabnode

services/
  webhook-worker/                           ← PM2 app, consumes BullMQ queue
```

---

## 14. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Codegen drift — hand-edits sneak in | CI check: every file under `src/app/api/v1/**/route.ts` must contain a `// @generated` header; hash-check against manifest. |
| Action signatures vary wildly (some return raw values, some `{ success, data }`) | Generator wraps the delegate call in an adapter; per-spec adapters can be hand-written when needed. ~10% of endpoints expected to need this. |
| Backward compatibility for the 24 existing hand-written routes | Phase 0 keeps them in place; generator emits *new* paths only. Existing paths are migrated in Phase 1 with a regression test pinning current responses. |
| Scope sprawl (every action gets its own scope) | Group at the resource verb level: `crm:leads:read` covers list/get; `crm:leads:write` covers create/update/delete. ~120 scopes total, not 600. |
| OAuth security mistakes | Authorization Code + PKCE only; no implicit; short-lived access tokens (1h) + refresh; bind tokens to client_id + redirect_uri; rotate refresh tokens on use. |
| Webhook dispatcher overwhelms DB on outage | Worker uses bounded concurrency + circuit-breaker per subscription URL. |
| Rust crate cardinality explodes (one per module) | Don't add a Rust crate per developer-API module — reuse the **existing 120 crates**. New crates only for genuinely new domains: oauth, PAT, webhook-dispatcher. |
| Test-mode side effects leak into production accounting | Test-mode keys cannot touch live billing rows; enforced at the credit-charge adapter, not at the handler. |

---

## 15. Open questions (need answers before Phase 0)

1. **OAuth app review:** do we require manual review of new third-party apps before they can request `sensitive` scopes (e.g. `billing:read`, `crm:hr:*`)? Suggest: yes for `*` and HR scopes.
2. **Bring-your-own webhook signing alg:** is HMAC-SHA256 enough or do we need Ed25519 from day one? Suggest: SHA256 only, document upgrade path.
3. **SDK languages beyond TS + Python:** PHP, Ruby, Go often requested in similar products. Defer to Phase 12 unless a customer is blocked.
4. **Pricing model for API usage:** does v1 reuse existing per-action credits, or do we add a separate "API request" SKU? Suggest: reuse credits, expose `X-Credits-Charged` header.
5. **CRM submodule depth:** some CRM modules (e.g. `crm-tds`, `crm-pt-slabs`, `crm-form-16`) are India-specific. Should they be `/api/v1/crm/india/*` to keep the global root clean? Suggest: yes.
6. **API key rotation:** support overlapping live + next key for zero-downtime rotation. Worth it for v1 or punt to v1.1? Suggest: ship in Phase 1, it's cheap if designed in.

---

## 16. Definition of done (for the whole module)

- `/api/v1/openapi` returns a 3.1 doc with 500+ paths, validated by `redocly lint`.
- `@sabnode/sdk` and `sabnode` published, smoke-tested with `me`, send-message, create-lead.
- A new tenant can: sign up → land on `/dashboard/api` → create a test key → run a request from the sandbox → create a webhook subscription → see a delivery in the log → switch to a live key → make a real send. End-to-end in <10 minutes, no docs hand-holding required.
- A third-party app can: register at `/dashboard/api/apps` → drive an authorization flow against a tenant → receive an access token → call any endpoint within its scopes → handle a webhook with verified signature.
- Webhook dispatcher sustains 1k events/sec aggregate with p95 first-attempt latency < 500ms.
- Per-key analytics surface in `/dashboard/api/usage` within 60s of request.

---

## 17. What I am asking you to approve before starting

1. **Phasing:** OK to go 0 → 11 in order? Or front-load OAuth before CRM bulk?
2. **Codegen-first approach:** big up-front investment in the manifest + generator (Phase 0 = a full week with zero user-visible endpoints). Is that acceptable, or do you want to start with hand-written endpoints and refactor later? (Strong recommendation: codegen-first. Hand-writing 500 endpoints is a year of work.)
3. **Folder reorg:** moving `/dashboard/api-keys` to `/dashboard/api/keys` is a small breaking change to bookmarks. Add a redirect and ship?
4. **Two-engineer assumption:** the 12–14 week estimate assumes two engineers full-time. Solo, double it.
5. **Open questions in §15** — answers needed before Phase 1 (Phase 0 can start without them).
