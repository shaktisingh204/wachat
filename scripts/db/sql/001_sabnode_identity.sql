-- Canonical DDL for the `sabnode_identity` Postgres schema (SabNode auth/users).
-- Applied by scripts/db/apply-identity-schema.mjs. Idempotent — safe to re-run.
-- This .sql is the SOURCE OF TRUTH for the schema; TypeScript ROW TYPES that
-- mirror it live in src/lib/postgres-schema.ts.
--
-- gen_random_uuid() is built into PostgreSQL 13+. On older servers run
--   CREATE EXTENSION IF NOT EXISTS pgcrypto;   (needs a superuser) first.

CREATE SCHEMA IF NOT EXISTS sabnode_identity;

CREATE TABLE IF NOT EXISTS sabnode_identity.users (
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
  ON sabnode_identity.users (lower(email));
CREATE INDEX IF NOT EXISTS users_firebase_uid_idx
  ON sabnode_identity.users (firebase_uid);

-- Full Mongo user document (minus secrets) so getSession can reconstruct the
-- exact legacy shape from Postgres without a Mongo round-trip. Added separately
-- (idempotent) because the identity migration may already have run on prod.
ALTER TABLE sabnode_identity.users
  ADD COLUMN IF NOT EXISTS profile jsonb;

CREATE TABLE IF NOT EXISTS sabnode_identity.user_sessions (
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
  ON sabnode_identity.user_sessions (user_id);

CREATE TABLE IF NOT EXISTS sabnode_identity.revoked_jti (
  jti        text PRIMARY KEY,
  user_id    text,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
CREATE INDEX IF NOT EXISTS revoked_jti_expires_idx
  ON sabnode_identity.revoked_jti (expires_at);

CREATE TABLE IF NOT EXISTS sabnode_identity.plans (
  id              text PRIMARY KEY,
  legacy_mongo_id text UNIQUE,
  name            text NOT NULL,
  data            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sabnode_identity.login_attempts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text,
  user_id    text,
  ip         text,
  outcome    text NOT NULL,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_email_idx
  ON sabnode_identity.login_attempts (lower(email), created_at DESC);

-- MFA methods (TOTP / WebAuthn / recovery). `user_id` is the Mongo `_id` string
-- (legacy id carried in the JWT), matching how revocation + sessions key on the
-- legacy id rather than the generated users.id uuid. Additive + idempotent.
CREATE TABLE IF NOT EXISTS sabnode_identity.mfa_methods (
  id           text PRIMARY KEY,
  user_id      text NOT NULL,
  kind         text,
  secret       text,
  label        text,
  data         jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS mfa_methods_user_idx
  ON sabnode_identity.mfa_methods (user_id);
