/**
 * C3 — `sabnode_identity` schema (Phase 0 contract).
 *
 * The SabNode-owned Postgres schema for AUTH + USER management (distinct from
 * twenty-server's `core` schema). Expressed here as (a) idempotent SQL DDL that
 * the Phase-2 migration runner applies, and (b) TypeScript row types the stores
 * (C2) and backfill scripts build against. Kept as plain SQL + types so Phase 0
 * compiles with no ORM dependency; a Drizzle layer can wrap these later without
 * changing the contract.
 *
 * Every users row keeps `legacy_mongo_id` (the Mongo `_id` string) so the
 * dual-write / backfill / reconcile stages (PLAN.md §3) can map 1:1 between
 * stores, and `twenty_user_id` for the Twenty bridge (C6).
 */

export const IDENTITY_SCHEMA = 'sabnode_identity';

/* ── Row types ─────────────────────────────────────────────── */

export interface PgUserRow {
  id: string; // uuid (SabNode canonical user id)
  legacy_mongo_id: string | null; // Mongo users._id as string
  email: string;
  name: string | null;
  picture: string | null;
  firebase_uid: string | null;
  plan_id: string | null;
  twenty_user_id: string | null; // bridge → twenty.user.id
  /** Monotonic revocation sentinel: tokens issued before this are invalid. */
  revoked_before: string | null; // ISO timestamp
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface PgSessionRow {
  id: string; // uuid (matches identity Session.id)
  user_id: string;
  org_id: string | null;
  kind: string | null; // web | api | cli
  user_agent: string | null;
  ip: string | null;
  mfa_passed: boolean | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface PgRevokedJtiRow {
  jti: string;
  user_id: string | null;
  revoked_at: string;
  /** Optional TTL to prune rows past the token's natural expiry. */
  expires_at: string | null;
}

export interface PgPlanRow {
  id: string;
  legacy_mongo_id: string | null;
  name: string;
  data: unknown; // JSONB — full plan document (limits/features)
  created_at: string;
  updated_at: string;
}

export interface PgLoginAttemptRow {
  id: string; // uuid
  email: string | null;
  user_id: string | null;
  ip: string | null;
  outcome: string; // success | failure | locked
  reason: string | null;
  created_at: string;
}

/* ── DDL ───────────────────────────────────────────────────── */

/**
 * Idempotent DDL for the whole `sabnode_identity` schema. Applied by the
 * Phase-2 migration step. Safe to re-run.
 */
export const IDENTITY_SCHEMA_DDL = /* sql */ `
CREATE SCHEMA IF NOT EXISTS ${IDENTITY_SCHEMA};

CREATE TABLE IF NOT EXISTS ${IDENTITY_SCHEMA}.users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_mongo_id text UNIQUE,
  email           text NOT NULL,
  name            text,
  picture         text,
  firebase_uid    text,
  plan_id         text,
  twenty_user_id  text,
  revoked_before  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
  ON ${IDENTITY_SCHEMA}.users (lower(email));
CREATE INDEX IF NOT EXISTS users_firebase_uid_idx
  ON ${IDENTITY_SCHEMA}.users (firebase_uid);

CREATE TABLE IF NOT EXISTS ${IDENTITY_SCHEMA}.user_sessions (
  id           uuid PRIMARY KEY,
  user_id      text NOT NULL,
  org_id       text,
  kind         text,
  user_agent   text,
  ip           text,
  mfa_passed   boolean,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz
);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx
  ON ${IDENTITY_SCHEMA}.user_sessions (user_id);

CREATE TABLE IF NOT EXISTS ${IDENTITY_SCHEMA}.revoked_jti (
  jti        text PRIMARY KEY,
  user_id    text,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
CREATE INDEX IF NOT EXISTS revoked_jti_expires_idx
  ON ${IDENTITY_SCHEMA}.revoked_jti (expires_at);

CREATE TABLE IF NOT EXISTS ${IDENTITY_SCHEMA}.plans (
  id              text PRIMARY KEY,
  legacy_mongo_id text UNIQUE,
  name            text NOT NULL,
  data            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ${IDENTITY_SCHEMA}.login_attempts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text,
  user_id    text,
  ip         text,
  outcome    text NOT NULL,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_email_idx
  ON ${IDENTITY_SCHEMA}.login_attempts (lower(email), created_at DESC);
`;
