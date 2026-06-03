# SabCRM × Twenty — Postgres Adoption & Full Twenty Clone: Execution Blueprint

> Verdict-first blueprint. Grounded in 7 parallel mapping reports + on-disk verification:
> the full Twenty monorepo (`twenty-server`, `twenty-front`, `twenty-shared`, `twenty-ui`,
> `twenty-cli`) is **already vendored** at `services/sabcrm/packages/`, `next.config.js`
> already lists `pg` + `mysql2` in `serverExternalPackages` (lines 79-80), the auth layer
> already has a swappable `SessionStore` interface (`src/lib/identity/sessions.ts:12`), and
> there are **815 files** reading the session. These four facts drive every decision below.

---

## 1. Architecture Recommendation — VERDICT

### The two options

| | **Option A — Run real `twenty-server`** | **Option B — Hand-port Twenty's backend into Next.js** |
|---|---|---|
| What | Boot the vendored `services/sabcrm/packages/twenty-server` (NestJS + TypeORM + Postgres + 4 GraphQL schemas) as a standalone service behind a new PM2 app; SabNode talks to it over GraphQL. | Re-implement Twenty's metadata engine, workspace-schema generation, GraphQL resolver builder, migration runner, and auth in TypeScript inside `src/`. |
| Effort | Wiring + auth bridge + seed. Weeks. | Re-build a metadata-driven multi-tenant ORM + dynamic DDL + GraphQL codegen. **Months-to-quarters**, and you re-inherit every bug Twenty already fixed. |
| Fidelity | 100% — it *is* Twenty. `twenty-front` runs as-is (frontend report: "HIGHLY FEASIBLE, 2-3 days" against a real backend). | Asymptotically approaches Twenty; never reaches it. The `process-nested-relations-v2.helper.ts`, `workspace-schema-manager/*`, flat-entity cache, and migration builder/runner are thousands of lines of load-bearing logic. |
| Risk | Operational (a new service, a new DB, auth bridging). Bounded and reversible. | Architectural + perpetual maintenance drift vs upstream. Unbounded. |

### **DECISION: Option A — run the real `twenty-server`.**

Rationale, grounded:
- The backend is **already in the repo** (`services/sabcrm/packages/twenty-server/package.json` confirms `start:prod`, `database:migrate:prod`, `worker:prod`, ClickHouse migrations — a complete NestJS app). Porting would throw away a working, vendored asset.
- Twenty's value is the **metadata-driven engine**: objects/fields are *rows* (`object-metadata.entity.ts`, `field-metadata.entity.ts`), per-workspace Postgres schemas `workspace_{base36(id)}` (`get-workspace-schema-name.util.ts:3-5`), dynamic DDL via `WorkspaceSchemaManager`, and a runtime-built GraphQL API (`find-many-resolver.factory.ts`). This is the part that is genuinely hard to port and is the entire point of "cloning Twenty."
- `twenty-front` consumes 4 endpoints (`/graphql`, `/metadata`, `/admin-panel`, `/rest`) and runs as-is — **do not port the frontend either.** Mount it under `/sabcrm`.
- Reversibility: a separate service can be turned off; the existing Rust+Mongo SabCRM path (`src/lib/rust-client/sabcrm-*.ts`, 18 clients) stays as a fallback during cutover (Seam B in the integration report).

> **SabNode does NOT become a NestJS app.** SabNode stays Next.js + Mongo. `twenty-server` is a **new sibling service** (like `services/sabwa-node/`), owning Postgres. SabNode is its **client and its identity provider**.

### Resulting topology

```
                         ┌────────────────────────── SabNode (Next.js, Mongo) ──────────────────────────┐
Browser ── /sabcrm ─────▶│  Next.js route mounts twenty-front (static build)                            │
                         │  Server actions (src/app/actions/sabcrm-*) ── data-layer router (Seam B) ─────┼──┐
                         │  Auth: Firebase + session JWT (unchanged) + Postgres user store (NEW)         │  │
                         └──────────────────────────────────────────────────────────────────────────────┘  │
                                                                                                              │ GraphQL + token bridge
   PM2 apps:  sabnode-web · sabnode-api(Rust) · sabwa-node · …        ┌─────────────────────────────────────▼──────────────┐
   NEW PM2 apps:  sabcrm-twenty-server  ·  sabcrm-twenty-worker  ───▶ │ twenty-server (NestJS) ── Postgres (core + per-ws)   │
                                                                       └──────────────────────────────────────────────────┘
   Databases:  Mongo (existing, unchanged)   +   Postgres (NEW, shared by twenty-server AND SabNode auth)
```

---

## 2. Dual-DB Design

### Postgres is introduced for TWO independent consumers sharing ONE cluster, TWO schemas

| Schema | Owner | Contents | Migrations run by |
|---|---|---|---|
| `core` + `workspace_{base36}` | **twenty-server** (TypeORM) | Twenty's `user`, `workspace`, `userWorkspace`, `appToken`, all `*Metadata`, per-workspace record tables (`object-metadata.entity.ts`, `workspace.entity.ts`, `core.datasource.ts:40-79`) | `twenty-server` `database:migrate:prod` + `WorkspaceMigrationRunnerService` |
| `sabnode_identity` | **SabNode** (Drizzle) | `users`, `user_sessions`, `revoked_jti`, `user_revocation_sentinels`, `login_attempts`, `plans` (the auth migration in report `sabnode-auth §13/14`) | `drizzle-kit migrate` |

These are **separate schemas in the same Postgres instance**. twenty-server's `user` table and SabNode's `sabnode_identity.users` are **distinct** — the auth bridge (§3) maps between them. This avoids forcing SabNode's user model onto Twenty's TypeORM entities and vice versa.

### Client choice

- **SabNode side:** `pg` (`Pool`) + **Drizzle ORM** for the `sabnode_identity` schema. Confirmed feasible — `pg` is already in `serverExternalPackages` (`next.config.js:79`). Drizzle is chosen for zero codegen, serverless-native pooling, and coexistence with Mongo.
- **twenty-server side:** untouched — it brings its own TypeORM + `pg`.

### Connection management (the hard part for a PM2 + serverless hybrid)

Create `src/lib/postgres.ts` — process-singleton `Pool` keyed on `cachedPool`, mirroring the existing `src/lib/mongodb.ts` singleton pattern (maxPoolSize 90 there).

**Connection math (grounded in `ecosystem.config.js`):** SabNode runs these PM2 apps that touch DBs: `sabnode-web`, `sabnode-broadcast-worker` (×N), `sabflow-worker` (×N), `sabnode-worker`, `sabnode-cron`. Each gets a SabNode Postgres pool.
- Set SabNode pool `max = 10` per process. Workers that never touch auth get `max = 2` or no pool (lazy-init only on first auth call).
- twenty-server (`sabcrm-twenty-server` + `sabcrm-twenty-worker`) brings its own TypeORM pool (~10 each).
- **Provision Postgres with `max_connections ≥ 200`** and front it with **PgBouncer (transaction pooling)** — non-negotiable for the PM2 fork-mode fan-out. This is an ops action (§6).

```ts
// src/lib/postgres.ts  (NEW) — mirrors src/lib/mongodb.ts singleton
import 'server-only';
import { Pool } from 'pg';
let cachedPool: Pool | null = null;
export function getPgPool(): Pool {
  if (cachedPool && !cachedPool.ending) return cachedPool;
  cachedPool = new Pool({
    connectionString: process.env.SABNODE_PG_URL,           // points at PgBouncer
    max: Number(process.env.SABNODE_PG_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 3_000,
  });
  return cachedPool;
}
```

### Which data lives where (decision table)

| Data | Home | Why |
|---|---|---|
| Auth: users, sessions, revocation, login audit, plans | **Postgres `sabnode_identity`** | Goal (2); relational, integrity-critical |
| Twenty CRM: objects/fields/records/views/workspaceMembers | **Postgres (twenty-server schemas)** | Goal (3); Twenty owns it natively |
| WhatsApp `projects`, `crm_*` legacy, SabFlow DAGs, notifications, SEO, message queues | **Mongo (unchanged)** | High-write/JSON-heavy; "keep Mongo" tier |
| Edge session validation (JWT signature) | **Neither** — stateless JWT in `proxy.ts` | Must stay zero-DB-call at edge |

### Coexistence rule
Mongo stays the system of record for everything except auth and Twenty-CRM. No cross-DB transactions. The mapping `sabnode_identity.users.id ↔ Mongo users._id ↔ twenty.user.id ↔ twenty.workspace.id ↔ project.twentyWorkspaceId` is maintained by application code (the bridge, §3/§4), stored as nullable columns/fields on both sides.

---

## 3. Auth Migration — Staged, Reversible, Live-SaaS-Safe

**Core principle: the session JWT contract NEVER changes.** `SessionPayload` (`src/lib/definitions.ts ~4250`) stays `{ userId, email, jti, exp, name?, picture? }`. Edge validation in `src/proxy.ts` stays a pure signature/expiry check (no DB). Firebase Admin stays as-is (`src/lib/auth.ts:75-119`). What changes is **where `users`, sessions, and revocation are read/written** — and that funnels through a handful of functions, not 815 files.

### The leverage point
815 files call `getSession` / `getCachedSession` / `getDecodedSession`. But they all bottom out in:
- `getSession()` — `src/app/actions/user.actions.ts:194`
- `getCachedSession()` — `src/lib/server-cache.ts:55`
- `verifyJwt()` / `isTokenRevoked()` / `isTokenRevokedForUser()` — `src/lib/auth.ts:129-165,183-212`
- `SessionStore` — `src/lib/identity/sessions.ts:12,21` (already an interface!)

We migrate the **store implementations behind these functions**. The 815 callers are untouched. This is the entire reason the migration is feasible without a 815-file diff.

### Touch-points that change (exhaustive)

| Function | File:line | Change |
|---|---|---|
| User upsert on login | `src/app/api/auth/session/route.ts:67-74` | Dual-write: Mongo + `sabnode_identity.users` |
| `getSession()` user lookup | `src/app/actions/user.actions.ts:194-232` | Read from Postgres (flag), fallback Mongo |
| `isTokenRevoked(jti)` | `src/lib/auth.ts:129-140` | Read `revoked_jti` (PG), fallback Mongo |
| `isTokenRevokedForUser` | `src/lib/auth.ts:148-165` | Read `user_revocation_sentinels` (PG) |
| Logout revocation | `src/app/logout/route.ts:22` | Dual-write revocation |
| Sign-out-everywhere | `src/app/actions/account.actions.ts:28` | Dual-write sentinel |
| `SessionStore` factory | `src/lib/identity/sessions.ts:21` | Add `createPostgresSessionStore()`; `createSessionStore()` chooses by flag |
| 2FA reads | `src/app/api/auth/two-fa/route.ts:39`, `two-fa.actions.ts` | Move `mfa_methods` to PG |
| Plans/RBAC ceiling | `src/lib/rbac-server.ts`, `plans` collection | `plans` → PG table |
| Login audit | `login_attempts` | → PG |
| Server cache TTL map | `src/lib/server-cache.ts:21-64` | **Unchanged** (works regardless of backend) |
| Rust BFF JWT | `src/lib/jwt-for-rust.ts`, `fetcher.ts:79-86` | **Unchanged** mechanism (but fix `tenantId` bug, §4) |

### Staged path (each stage independently revertible by one env flag)

```
Flag ladder (single source of truth in env):
  AUTH_PG_WRITE = off|dual|pg-only     # write path
  AUTH_PG_READ  = mongo|pg-fallback|pg # read path
```

| Stage | Action | Read | Write | Revert |
|---|---|---|---|---|
| **0. Schema** | Drizzle migrate `sabnode_identity` (users, sessions, revoked_jti, sentinels, login_attempts, plans, mfa_methods) | mongo | off | drop schema |
| **1. Backfill** | Offline script copies Mongo `users`/`plans` → PG, preserving `_id` as `legacy_mongo_id` column | mongo | off | no-op |
| **2. Dual-write** | `AUTH_PG_WRITE=dual` — every user upsert/revocation writes both. PG failures are logged, NOT fatal | mongo | dual | set `off` |
| **3. Read-canary** | `AUTH_PG_READ=pg-fallback` — read PG, on miss/error fall back to Mongo + emit metric | pg-fallback | dual | set `mongo` |
| **4. Continuous reconcile** | Cron diffs PG vs Mongo users; alert on drift before trusting PG | pg-fallback | dual | — |
| **5. PG-primary** | `AUTH_PG_READ=pg` (Mongo still dual-written as hot backup) | pg | dual | set `pg-fallback` |
| **6. Cutover** | `AUTH_PG_WRITE=pg-only` after a soak window | pg | pg-only | set `dual` |
| **7. Cleanup** | Drop Mongo auth collections (only after weeks at stage 6) | pg | pg-only | restore from backup |

### Production risks (live SaaS) + mitigations
- **Session-wide lockout** if PG read path is wrong → mitigated by stages 3-5 fallback-to-Mongo and the unchanged edge JWT (logged-in users keep validating at the edge even if PG is down).
- **Connection exhaustion** under PM2 fan-out → PgBouncer + per-process `max=10` (§2).
- **Clock/sentinel skew** breaking revocation → keep `revokedBefore` semantics identical to Mongo (`auth.ts:148-165`); dual-write means a missed PG revocation still revokes in Mongo until stage 6.
- **Backfill drift** (users created mid-migration) → stage 4 reconcile cron is the gate to stage 5.

---

## 4. Twenty Clone Plan

### Data model — adopt Twenty's verbatim (do not redesign)
- **Core (global):** `user`, `workspace`, `userWorkspace`, `appToken`, `workspaceSSOIdentityProvider`.
- **Metadata (in `core`):** `objectMetadata`, `fieldMetadata`, `indexMetadata`, `view`, `role`, `permission`, `webhook`.
- **Per-workspace dynamic tables:** `workspace_{base36(workspaceId)}` schema, tables generated from `fieldMetadata` rows via `WorkspaceSchemaManager` (table/column/enum/FK/index managers). One CRM tenant = one Twenty workspace.

### Tenancy mapping (the central design choice)
**One SabNode `project` → one Twenty `workspace`.** Persist the link on both sides:
- `projects.twentyWorkspaceId` (Mongo, new field) and `sabnode_identity.users.twentyUserId`.
- This is the `bridgeUserToTwenty()` contract (Seam C).

### Relations & ACTOR resolution
- **Relations** (`RELATION`/`MORPH_RELATION`) are ID-only FKs; hydration is opt-in via `ProcessNestedRelationsV2Helper` (`process-nested-relations-v2.helper.ts:66-88`). **Implication for SabNode actions:** GraphQL queries must explicitly select nested fields or records come back "hollow." The data-layer adapter (§5 contract) must request the field set the UI needs.
- **ACTOR** (`createdBy`) is **not a relation** — it's a composite JSON `{ source, workspaceMemberId, name, context }` (`transform-actor-field.util.ts:7-32`). It is **not auto-hydrated**; `workspaceMemberId` is a bare string. The SabNode→Twenty user bridge must stamp ACTOR fields at write time with the mapped `workspaceMemberId`.

### Seed data
Use Twenty's own dev-seeder pipeline (`dev-seeder.service.ts:47-80`) for demo workspaces, and its dependency-batched seed (`dev-seeder-data.service.ts:122-144`: Batch1 workspaceMember → Batch2 company/person → Batch3 tasks/notes). For real tenants, seeding = create workspace → `WorkspaceManagerService` initializes standard objects + default roles + the owner's `workspaceMember`.

### Frontend
**Run `twenty-front` as-is** mounted under `/sabcrm` (frontend report verdict: HIGHLY FEASIBLE, 2-3 days). It needs all 4 endpoints (`/graphql`, `/metadata`, `/admin-panel`, `/rest`) reachable. Token comes from the bridge (contract C6). Do **not** attempt to port Jotai/Apollo components (3-6 months, HIGH risk). This honors `MEMORY.md`: SabCRM uses Twenty's UI (`.sabcrm-twenty`), not ZoruUI.

---

## 5. Execution Decomposition — Phases, Parallel Agents, Shared Contracts

### Shared contracts (DEFINE FIRST — agents build against these, never against each other)

> **Contract freeze is Phase 0. No build agent starts until these files exist and compile.**

- **C1 — `src/lib/postgres.ts`**: `getPgPool(): Pool`. (§2)
- **C2 — `src/lib/identity/pg-stores.ts`**: `createPostgresSessionStore(): SessionStore` implementing the existing `SessionStore` interface (`sessions.ts:12`) + `pgUserStore` + `pgRevocationStore`. Signatures match current Mongo functions so callers are untouched.
- **C3 — Drizzle schema `src/lib/postgres-schema.ts`** for `sabnode_identity.*`, with `legacy_mongo_id` + `twentyUserId` columns.
- **C4 — Auth flag module `src/lib/identity/auth-flags.ts`**: typed readers for `AUTH_PG_WRITE` / `AUTH_PG_READ`.
- **C5 — Twenty client `src/lib/data-layer/twenty-client.ts`**: `twentyFetch<T>(query, vars, ctx)` against `/metadata` + `/graphql`.
- **C6 — Auth bridge `src/lib/sabcrm/twenty-user-bridge.ts`**: `bridgeUserToTwenty(userId, projectId) → { twentyWorkspaceId, twentyUserId, twentyRole, token }`. (Seam C)
- **C7 — RBAC bridge `src/lib/sabcrm/twenty-rbac-bridge.ts`**: SabNode `EffectivePermissions` ↔ Twenty role. (Seam D)
- **C8 — Data-layer router `src/lib/data-layer/router.ts`**: `interface CrmDataLayer` + `getCrmDataLayer(projectId)` returning Rust-impl or Twenty-impl by flag. (Seam B)
- **C9 — twenty-server PM2 contract**: env keys (`PG_DATABASE_URL`, `APP_SECRET`, ports for the 4 endpoints), PM2 app names `sabcrm-twenty-server` / `sabcrm-twenty-worker`.

### Phases

**Phase 0 — Contracts & provisioning (serial, blocking).** Author C1-C9 as compiling stubs. Ops provisions Postgres + PgBouncer (§6). Single author, no parallelism.

**Phase 1 — Stand up twenty-server (parallel after Phase 0).**
- Agent 1A: PM2 entries `sabcrm-twenty-server` + `sabcrm-twenty-worker` in `services/sabcrm/ecosystem.config.js` + root wiring; run `database:init:prod` against `core`.
- Agent 1B: Reverse-proxy/route config so `/sabcrm/api/{graphql,metadata,admin-panel,rest}` reach twenty-server; health checks.
- Agent 1C: Build `twenty-front`, mount static under `/sabcrm`, wire `REACT_APP_SERVER_BASE_URL`.
- Agent 1D: Implement C5 `twentyFetch` + a smoke GraphQL query.
*(No collisions: each owns distinct files/services.)*

**Phase 2 — Postgres auth foundation (parallel).**
- Agent 2A: C3 Drizzle schema + `drizzle.config.ts` + migrations (`sabnode_identity`).
- Agent 2B: C2 PG stores (user/session/revocation) implementing `SessionStore`.
- Agent 2C: C4 flags + wire dual-write into `session/route.ts:67`, `logout/route.ts:22`, `account.actions.ts:28` (write path only; reads stay Mongo).
- Agent 2D: Backfill + reconcile-cron scripts (stages 1 & 4).

**Phase 3 — Auth cutover (serial gates, ops-driven).** Flip flags stage 3→6 with soak windows. Not parallel — each stage is a gated decision.

**Phase 4 — Twenty data integration (parallel).**
- Agent 4A: C6 user bridge + `projects.twentyWorkspaceId` provisioning on project create + workspace init via `WorkspaceManagerService`.
- Agent 4B: C7 RBAC bridge + integrate into the gate in `sabcrm-twenty.actions.ts:103-136`.
- Agent 4C: C8 Twenty-impl of `CrmDataLayer` for records/views/activities (uses C5 + nested-relation/ACTOR rules from §4).
- Agent 4D: **Fix the `tenantId=userId` bug** (`fetcher.ts:79-86,141-143`) — thread real `projectId`; needed for both Rust fallback and Twenty path.
- Agent 4E: Seed pipeline wiring (dev-seeder for demo, standard-object init for real tenants).

**Phase 5 — CRM cutover & cleanup (serial gates).** Per-project flip Rust→Twenty via C8 router; soak; then deprecate Rust SabCRM clients; finally drop Mongo auth collections (auth stage 7).

---

## 6. Risk + Rollback + Human/Ops Actions

### Rollback matrix
| Failure | Blast radius | Rollback (seconds-to-minutes) |
|---|---|---|
| PG auth reads wrong/down | Login + session refresh | `AUTH_PG_READ=mongo`; edge JWT keeps existing sessions alive |
| PG dual-write errors | None (logged, non-fatal) | `AUTH_PG_WRITE=off` |
| twenty-server down | `/sabcrm` only | C8 router → Rust-impl per project; rest of SabNode unaffected |
| Connection exhaustion | Multiple services | PgBouncer caps; lower per-process `max`; restart PM2 app |
| Twenty data corruption in a workspace | One tenant | Workspace is isolated schema `workspace_{id}`; restore that schema only |
| Backfill drift | Stale auth reads | Reconcile cron blocks promotion to stage 5 |

**Invariant guaranteeing reversibility:** session JWT contract + edge validation + Firebase + Rust JWT mechanism are *never* changed. Every migration is a swap of a store behind a stable function signature, toggled by a single env flag.

### Steps requiring HUMAN / OPS action (cannot be agent-automated)
1. **Provision Postgres** (managed instance, `max_connections ≥ 200`, automated backups/PITR) — self-hosted per `MEMORY.md`, *not* Vercel Postgres.
2. **Provision + configure PgBouncer** (transaction pooling) in front of Postgres.
3. **Set env vars across all PM2 apps** (`ecosystem.config.js`): `SABNODE_PG_URL`, `SABNODE_PG_POOL_MAX`, twenty-server's `PG_DATABASE_URL`/`APP_SECRET`, `AUTH_PG_WRITE`, `AUTH_PG_READ`. Operator-owned secrets.
4. **Run `twenty-server` DB init** (`yarn database:init:prod`) against the `core` schema — one-time, destructive if mis-pointed; ops-supervised.
5. **Run the user/plan backfill** (stage 1) during a low-traffic window; verify reconcile cron is green before promoting reads.
6. **Flip auth stage flags 3→6** — each is a human go/no-go decision with a soak window and metric review.
7. **Per-project CRM cutover** Rust→Twenty (Phase 5) — product/ops decision per tenant.
8. **Drop Mongo auth collections** (final, only after weeks at PG-primary; take a backup first).
9. **Add `sabcrm-twenty-server`/`-worker` to PM2 startup + monitoring/alerting** (connection count, GraphQL latency, auth fallback rate).

---

## Appendix — Why this is safe to start now
- Backend already vendored: `services/sabcrm/packages/twenty-server` (verified: `start:prod`, `database:migrate:prod`, `worker:prod`).
- Frontend already vendored: `services/sabcrm/packages/twenty-front`.
- `pg` already external in build: `next.config.js:79-80`.
- Auth already abstracted behind `SessionStore`: `src/lib/identity/sessions.ts:12`.
- 815 session callers funnel through ~5 functions — migration is store-swap, not mass-edit.
- Existing Rust+Mongo SabCRM path stays as a live fallback throughout (`src/lib/rust-client/sabcrm-*.ts`).
