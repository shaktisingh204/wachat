# Auth → Postgres cutover runbook (operator, on the server)

Staged Mongo→Postgres auth migration. Every step is reversible by one env flag.
Defaults (`AUTH_PG_WRITE` unset → `off`, `AUTH_PG_READ` unset → `mongo`) are
byte-identical to pre-migration behaviour, verified gate-by-gate.

> Prereq: Postgres + PgBouncer provisioned, `SABNODE_PG_URL` set, `git pull`.

| # | Action | Command / flag | Revert |
|---|--------|----------------|--------|
| 1 | **Apply schema** (idempotent) | `npm run db:identity:migrate` → tables: users, user_sessions, revoked_jti, plans, login_attempts, mfa_methods | `DROP SCHEMA sabnode_identity CASCADE;` |
| 2 | **Backfill** (dry-run first) | `node --env-file=.env scripts/db/backfill-users.mjs --dry-run` then without `--dry-run` (migrates plans, users + `profile` JSONB minus secrets, embedded TOTP → mfa_methods) | `TRUNCATE sabnode_identity.users, plans, mfa_methods;` (idempotent — safe to re-run) |
| 3 | **Reconcile — must be green** | `node --env-file=.env scripts/db/reconcile-users.mjs` (exit 0). **Also spot-check a few `profile` blobs are non-empty** — reconcile only checks `_id/email/name`. | n/a |
| 4 | **Dual-write** (soak) | `AUTH_PG_WRITE=dual` — logins/logout/2FA write both stores; Mongo stays authoritative. Watch logs for `(non-fatal)` PG errors. | unset `AUTH_PG_WRITE` |
| 5 | **Read canary** (soak) | `AUTH_PG_READ=pg-fallback` — read PG first, fall back to Mongo on any miss/error (cannot lock out). | `AUTH_PG_READ=mongo` |
| 6 | **PG-primary read** | `AUTH_PG_READ=pg` — **gate: backfill+reconcile green AND every active user has a non-empty `profile`** (else strict-pg returns null = logout). | `AUTH_PG_READ=pg-fallback` (instant) |
| 7 | **Stop Mongo auth writes** | `AUTH_PG_WRITE=pg-only` | `AUTH_PG_WRITE=dual` |

## Residual Mongo touches (tracked — being closed in the cleanup pass)
Even after step 7, these still touch Mongo until the cleanup lands:
- **V-1** legacy `getSession` in `src/lib/actions/user.actions.ts` (used by `sabcatalyst.actions.ts`) — pure Mongo.
- **V-2** login bootstrap (`plans.findOne({isDefault})`, user `findOne`) + **`login_attempts`** writes (Mongo-only; PG table/type exist but no writer).
- **V-3** email-2FA transient challenge codes — Mongo-only (TOTP 2FA is on PG).
- **V-4** account preferences accessors — Mongo-only (read-side served from `profile` via getSession; dedicated setters bypass it).

Until V-1–V-4 are closed, auth is **PG-primary but not 100% Mongo-free**.
The core decision path (session identity, jti/sentinel revocation, TOTP 2FA,
session store) IS Postgres under `pg`.
