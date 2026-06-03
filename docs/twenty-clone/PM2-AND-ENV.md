# C9 — twenty-server PM2 + env contract (Phase 0)

The operator-owned wiring the build agents (Phase 1+) and ops depend on. Nothing
here runs until Postgres is provisioned and these are set.

## New PM2 apps (added in Phase 1, `services/sabcrm/ecosystem.config.js`)

| App | Command | Role |
|-----|---------|------|
| `sabcrm-twenty-server` | `yarn workspace twenty-server start:prod` | NestJS API — serves `/graphql`, `/metadata`, `/admin-panel`, `/rest` |
| `sabcrm-twenty-worker` | `yarn workspace twenty-server worker:prod` | Background jobs (BullMQ) |

Both connect to **Postgres** (their own TypeORM pool) and **Redis** (existing).

## Environment variables

### SabNode side (set on `sabnode-web` + any auth-touching worker)
| Var | Default | Meaning |
|-----|---------|---------|
| `SABNODE_PG_URL` | _(unset)_ | Postgres conn string for the `sabnode_identity` schema. **Point at PgBouncer.** |
| `SABNODE_PG_POOL_MAX` | `10` | Per-process pool size (keep small for PM2 fork-mode). |
| `AUTH_PG_WRITE` | `off` | `off` \| `dual` \| `pg-only` — auth write path. |
| `AUTH_PG_READ` | `mongo` | `mongo` \| `pg-fallback` \| `pg` — auth read path. |
| `TWENTY_SERVER_URL` | `http://127.0.0.1:3000` | Base URL of twenty-server for the C5 client. |
| `CRM_DATA_LAYER` | `rust` | `rust` \| `twenty` — which backend serves SabCRM records. |

### twenty-server side (operator secrets; see its own `.env` template)
`PG_DATABASE_URL` (its `core` schema), `APP_SECRET`, `REDIS_URL`, server port, and
storage/email config per upstream Twenty. Run `yarn database:init:prod` once
against the target Postgres before first boot (destructive if mis-pointed).

## Postgres topology (one cluster, two owners)

```
Postgres cluster  ──(PgBouncer, transaction pooling)──┐
  ├─ schema core + workspace_{base36(id)}   ← twenty-server (TypeORM migrations)
  └─ schema sabnode_identity                ← SabNode (raw SQL DDL in src/lib/postgres-schema.ts)
```

Provision with `max_connections ≥ 200`, automated backups + PITR. Self-hosted
(per project conventions), **not** Vercel Postgres.

## Phase 0 contract files (already authored, compile with no live DB)

| Contract | File |
|----------|------|
| C1 pool | `src/lib/postgres.ts` |
| C2 stores | `src/lib/identity/pg-stores.ts` |
| C3 schema | `src/lib/postgres-schema.ts` |
| C4 flags | `src/lib/identity/auth-flags.ts` |
| C5 twenty client | `src/lib/data-layer/twenty-client.ts` |
| C6 user bridge | `src/lib/sabcrm/twenty-user-bridge.ts` |
| C7 rbac bridge | `src/lib/sabcrm/twenty-rbac-bridge.ts` |
| C8 data-layer router | `src/lib/data-layer/router.ts` |
| C9 this contract | `docs/twenty-clone/PM2-AND-ENV.md` + `.env.example` |
