/**
 * Phase 2A — schema migration runner for the `sabnode_identity` Postgres schema.
 *
 * Applies the idempotent DDL from the C3 Phase-0 contract
 * (`src/lib/postgres-schema.ts`) inside a single transaction, then reports which
 * tables exist in the schema afterwards.
 *
 * Run with:
 *   node --env-file=.env scripts/db/apply-identity-schema.ts
 *
 * Requires env: SABNODE_PG_URL  (Postgres connection string)
 *
 * INERT by default: this script only runs when an operator invokes it. It does
 * not change live behaviour on import and is safe to re-run (idempotent DDL).
 */

import { Pool } from 'pg';

// C3 — pure, no other imports. Relative import with .ts extension so this runs
// under `node --experimental-strip-types` (Node's native TS stripping) without
// a build step.
import { IDENTITY_SCHEMA, IDENTITY_SCHEMA_DDL } from '../../src/lib/postgres-schema.ts';

async function main(): Promise<void> {
  const connectionString = process.env.SABNODE_PG_URL;
  if (!connectionString) {
    throw new Error(
      'SABNODE_PG_URL is not set. Provide it via .env (e.g. node --env-file=.env ...) or the environment.',
    );
  }

  const pool = new Pool({ connectionString });

  try {
    console.log(`[apply-identity-schema] connecting…`);
    const client = await pool.connect();
    try {
      console.log(`[apply-identity-schema] applying DDL for schema "${IDENTITY_SCHEMA}" (idempotent)…`);
      await client.query('BEGIN');
      try {
        await client.query(IDENTITY_SCHEMA_DDL);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }

      console.log(`[apply-identity-schema] DDL applied. Inspecting information_schema…`);
      const { rows } = await client.query<{ table_name: string }>(
        `SELECT table_name
           FROM information_schema.tables
          WHERE table_schema = $1
          ORDER BY table_name`,
        [IDENTITY_SCHEMA],
      );

      if (rows.length === 0) {
        console.log(`[apply-identity-schema] WARNING: no tables found in schema "${IDENTITY_SCHEMA}".`);
      } else {
        console.log(`[apply-identity-schema] tables now present in "${IDENTITY_SCHEMA}":`);
        for (const r of rows) {
          console.log(`  • ${IDENTITY_SCHEMA}.${r.table_name}`);
        }
      }
      console.log(`[apply-identity-schema] done (${rows.length} table(s)).`);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[apply-identity-schema] FAILED:', err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exitCode = 1;
  process.exit(1);
});
