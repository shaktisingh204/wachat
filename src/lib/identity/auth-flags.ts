/**
 * C4 — Auth backend flags (Phase 0 contract).
 *
 * The single source of truth for the staged Mongo→Postgres auth migration
 * (PLAN.md §3). Two env vars drive the write path and the read path; each stage
 * of the migration is a flag flip and reverts the same way. Defaults are the
 * SAFE current behaviour — `off` writes and `mongo` reads — so importing /
 * deploying this code changes nothing until an operator opts in.
 */

/** Write path: where user/revocation writes go. */
export type AuthPgWrite = 'off' | 'dual' | 'pg-only';

/** Read path: where user/revocation reads come from. */
export type AuthPgRead = 'mongo' | 'pg-fallback' | 'pg';

const WRITE_VALUES: ReadonlySet<AuthPgWrite> = new Set(['off', 'dual', 'pg-only']);
const READ_VALUES: ReadonlySet<AuthPgRead> = new Set(['mongo', 'pg-fallback', 'pg']);

/** Current write mode (default `off`). */
export function authPgWrite(): AuthPgWrite {
  const v = process.env.AUTH_PG_WRITE;
  return v && WRITE_VALUES.has(v as AuthPgWrite) ? (v as AuthPgWrite) : 'off';
}

/** Current read mode (default `mongo`). */
export function authPgRead(): AuthPgRead {
  const v = process.env.AUTH_PG_READ;
  return v && READ_VALUES.has(v as AuthPgRead) ? (v as AuthPgRead) : 'mongo';
}

/** True when writes should touch Postgres (dual or pg-only). */
export function shouldWritePg(): boolean {
  return authPgWrite() !== 'off';
}

/** True when writes should still touch Mongo (off or dual — i.e. not pg-only). */
export function shouldWriteMongo(): boolean {
  return authPgWrite() !== 'pg-only';
}

/** True when reads should consult Postgres first (pg-fallback or pg). */
export function shouldReadPg(): boolean {
  return authPgRead() !== 'mongo';
}

/** True when a Postgres read miss/error may fall back to Mongo. */
export function pgReadAllowsFallback(): boolean {
  return authPgRead() === 'pg-fallback';
}
