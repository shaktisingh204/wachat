import 'server-only';

/**
 * C1 — SabNode Postgres connection (Phase 0 contract).
 *
 * Process-singleton `pg.Pool`, mirroring the Mongo singleton in
 * `src/lib/mongodb.ts`. This is the SabNode-side Postgres client used by the
 * `sabnode_identity` schema (auth/users/sessions) — it is SEPARATE from
 * `twenty-server`'s own TypeORM pool, which manages the `core` + per-workspace
 * schemas.
 *
 * Connection management for the PM2 + serverless hybrid (see
 * `docs/twenty-clone/PLAN.md` §2): keep `max` small per process and front the
 * real Postgres with PgBouncer (transaction pooling). The pool lazily connects
 * on first query, so importing this module is free until something runs a query
 * — which only happens once the auth flags (C4) opt a code path into Postgres.
 */

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

let cachedPool: Pool | null = null;

/** Returns the process-wide Postgres pool, creating it on first use. */
export function getPgPool(): Pool {
  if (cachedPool && !cachedPool.ending) return cachedPool;

  const connectionString = process.env.SABNODE_PG_URL;
  if (!connectionString) {
    // Fail loud + clear: a code path opted into Postgres (via the auth flags)
    // before the instance was provisioned / env wired. The flags default to
    // "off"/"mongo" so this should never fire in the default configuration.
    throw new Error(
      'SABNODE_PG_URL is not set — Postgres was requested but is not configured. ' +
        'Provision Postgres + PgBouncer and set SABNODE_PG_URL before enabling AUTH_PG_* flags.',
    );
  }

  cachedPool = new Pool({
    connectionString, // should point at PgBouncer in production
    max: Number(process.env.SABNODE_PG_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 3_000,
  });

  // Never let an idle-client error crash the process; log + let the pool heal.
  cachedPool.on('error', (err) => {
    console.error('[postgres] idle client error', err);
  });

  return cachedPool;
}

/** Convenience: run a parameterized query against the pool. */
export async function pgQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: ReadonlyArray<unknown>,
): Promise<QueryResult<T>> {
  return getPgPool().query<T>(text, params as unknown[] | undefined);
}

/** Run `fn` inside a single transaction, committing on success / rolling back on throw. */
export async function pgTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** True when a Postgres connection string is configured (does not connect). */
export function isPostgresConfigured(): boolean {
  return Boolean(process.env.SABNODE_PG_URL);
}

/** Closes the pool (tests / graceful shutdown). Safe to call when never opened. */
export async function closePgPool(): Promise<void> {
  if (cachedPool) {
    const pool = cachedPool;
    cachedPool = null;
    await pool.end();
  }
}
