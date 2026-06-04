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
// The canonical schema DDL lives in scripts/db/sql/001_sabnode_identity.sql
// (applied by scripts/db/apply-identity-schema.mjs — plain Node 20, no .ts).
// The row types above mirror it; keep the two in sync when adding columns.
