import 'server-only';

/**
 * C2 — Postgres-backed identity stores (Phase 0 contract).
 *
 * Drop-in Postgres implementations behind the SAME signatures the current Mongo
 * code already exposes, so the 815 session callers never change (PLAN.md §3):
 *
 *   - `createPostgresSessionStore()` → the existing {@link SessionStore} shape
 *     (`src/lib/identity/sessions.ts`), so `listSessions`/`revokeSession`/etc.
 *     can be pointed at Postgres by passing this store.
 *   - {@link pgUserStore} → user upsert / lookup used by the login + session
 *     read paths.
 *   - {@link pgRevocationStore} → jti + per-user revocation, mirroring the
 *     semantics of `isTokenRevoked` / `isTokenRevokedForUser` in `auth.ts`.
 *
 * Queries are parameterized raw SQL against the C1 pool + C3 schema. They are
 * only reached when the C4 flags opt a path into Postgres, so this module is
 * inert under the default (`off`/`mongo`) configuration.
 */

import { pgQuery } from '@/lib/postgres';
import { IDENTITY_SCHEMA, type PgUserRow } from '@/lib/postgres-schema';
import type { SessionStore } from './sessions';
import type { Session } from './types';

/* ── helpers ───────────────────────────────────────────────── */

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function toIsoOrUndef(v: unknown): string | undefined {
  return v === null || v === undefined ? undefined : toIso(v);
}

function rowToSession(r: Record<string, unknown>): Session {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    orgId: (r.org_id as string | null) ?? undefined,
    createdAt: toIso(r.created_at),
    lastSeenAt: toIso(r.last_seen_at),
    expiresAt: toIso(r.expires_at),
    userAgent: (r.user_agent as string | null) ?? undefined,
    ip: (r.ip as string | null) ?? undefined,
    mfaPassed: (r.mfa_passed as boolean | null) ?? undefined,
    kind: (r.kind as Session['kind']) ?? undefined,
    revokedAt: toIsoOrUndef(r.revoked_at),
  };
}

const T = `${IDENTITY_SCHEMA}.user_sessions`;

/* ── SessionStore (Postgres) ───────────────────────────────── */

export function createPostgresSessionStore(): SessionStore {
  return {
    async insert(s: Session) {
      await pgQuery(
        `INSERT INTO ${T}
           (id, user_id, org_id, kind, user_agent, ip, mfa_passed, created_at, last_seen_at, expires_at, revoked_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING`,
        [
          s.id, s.userId, s.orgId ?? null, s.kind ?? null, s.userAgent ?? null,
          s.ip ?? null, s.mfaPassed ?? null, s.createdAt, s.lastSeenAt, s.expiresAt,
          s.revokedAt ?? null,
        ],
      );
    },

    async listForUser(userId, opts) {
      const where = opts?.includeRevoked
        ? 'user_id = $1'
        : 'user_id = $1 AND revoked_at IS NULL';
      const { rows } = await pgQuery(
        `SELECT * FROM ${T} WHERE ${where} ORDER BY last_seen_at DESC`,
        [userId],
      );
      return rows.map(rowToSession);
    },

    async findById(id) {
      const { rows } = await pgQuery(`SELECT * FROM ${T} WHERE id = $1`, [id]);
      return rows[0] ? rowToSession(rows[0]) : null;
    },

    async revoke(id, now = new Date()) {
      const { rows } = await pgQuery(
        `UPDATE ${T} SET revoked_at = $2 WHERE id = $1 RETURNING *`,
        [id, now.toISOString()],
      );
      return rows[0] ? rowToSession(rows[0]) : null;
    },

    async revokeAllForUser(userId, opts) {
      const now = (opts?.now ?? new Date()).toISOString();
      const params: unknown[] = [userId, now];
      let sql = `UPDATE ${T} SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL`;
      if (opts?.exceptId) {
        params.push(opts.exceptId);
        sql += ` AND id <> $3`;
      }
      const res = await pgQuery(sql, params);
      return res.rowCount ?? 0;
    },

    async touch(id, now = new Date()) {
      await pgQuery(`UPDATE ${T} SET last_seen_at = $2 WHERE id = $1`, [
        id,
        now.toISOString(),
      ]);
    },
  };
}

/* ── User store (Postgres) ─────────────────────────────────── */

export interface PgUserStore {
  findById(id: string): Promise<PgUserRow | null>;
  findByEmail(email: string): Promise<PgUserRow | null>;
  findByMongoId(legacyMongoId: string): Promise<PgUserRow | null>;
  /** Upsert keyed on `legacy_mongo_id` (always present on the dual-write path). */
  upsertByMongoId(input: {
    legacyMongoId: string;
    email: string;
    name?: string | null;
    picture?: string | null;
    firebaseUid?: string | null;
    planId?: string | null;
  }): Promise<PgUserRow>;
}

const U = `${IDENTITY_SCHEMA}.users`;

export const pgUserStore: PgUserStore = {
  async findById(id) {
    const { rows } = await pgQuery<PgUserRow>(`SELECT * FROM ${U} WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },
  async findByEmail(email) {
    const { rows } = await pgQuery<PgUserRow>(
      `SELECT * FROM ${U} WHERE lower(email) = lower($1) LIMIT 1`,
      [email],
    );
    return rows[0] ?? null;
  },
  async findByMongoId(legacyMongoId) {
    const { rows } = await pgQuery<PgUserRow>(
      `SELECT * FROM ${U} WHERE legacy_mongo_id = $1`,
      [legacyMongoId],
    );
    return rows[0] ?? null;
  },
  async upsertByMongoId(input) {
    const { rows } = await pgQuery<PgUserRow>(
      `INSERT INTO ${U} (legacy_mongo_id, email, name, picture, firebase_uid, plan_id, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6, now())
       ON CONFLICT (legacy_mongo_id) DO UPDATE SET
         email = EXCLUDED.email,
         name = EXCLUDED.name,
         picture = EXCLUDED.picture,
         firebase_uid = COALESCE(EXCLUDED.firebase_uid, ${U}.firebase_uid),
         plan_id = COALESCE(EXCLUDED.plan_id, ${U}.plan_id),
         updated_at = now()
       RETURNING *`,
      [
        input.legacyMongoId, input.email, input.name ?? null, input.picture ?? null,
        input.firebaseUid ?? null, input.planId ?? null,
      ],
    );
    return rows[0];
  },
};

/* ── Revocation store (Postgres) ───────────────────────────── */

export interface PgRevocationStore {
  isJtiRevoked(jti: string): Promise<boolean>;
  revokeJti(jti: string, opts?: { userId?: string; expiresAt?: Date }): Promise<void>;
  /** True when a token issued at `issuedAt` predates the user's revocation sentinel. */
  isRevokedForUser(userId: string, issuedAt: Date): Promise<boolean>;
  /** Bump the per-user sentinel so all tokens issued before `now` are invalid. */
  revokeAllForUser(userId: string, now?: Date): Promise<void>;
}

const J = `${IDENTITY_SCHEMA}.revoked_jti`;

export const pgRevocationStore: PgRevocationStore = {
  async isJtiRevoked(jti) {
    const { rows } = await pgQuery(`SELECT 1 FROM ${J} WHERE jti = $1 LIMIT 1`, [jti]);
    return rows.length > 0;
  },
  async revokeJti(jti, opts) {
    await pgQuery(
      `INSERT INTO ${J} (jti, user_id, expires_at) VALUES ($1,$2,$3)
       ON CONFLICT (jti) DO NOTHING`,
      [jti, opts?.userId ?? null, opts?.expiresAt?.toISOString() ?? null],
    );
  },
  async isRevokedForUser(userId, issuedAt) {
    // Callers pass the SabNode user id (the Mongo _id string, carried in the
    // JWT), so match on legacy_mongo_id — NOT the generated uuid PK.
    const { rows } = await pgQuery<{ revoked_before: Date | string | null }>(
      `SELECT revoked_before FROM ${U} WHERE legacy_mongo_id = $1`,
      [userId],
    );
    const rb = rows[0]?.revoked_before;
    if (!rb) return false;
    return new Date(toIso(rb)).getTime() > issuedAt.getTime();
  },
  async revokeAllForUser(userId, now = new Date()) {
    await pgQuery(
      `UPDATE ${U} SET revoked_before = $2, updated_at = now() WHERE legacy_mongo_id = $1`,
      [userId, now.toISOString()],
    );
  },
};
