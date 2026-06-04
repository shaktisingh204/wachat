// Applies the sabnode_identity schema (scripts/db/sql/001_sabnode_identity.sql).
// Node >= 20 ESM, no TypeScript (the server runs Node 20, which can't execute .ts).
// Run: node --env-file=.env scripts/db/apply-identity-schema.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const { Pool } = pg;
const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, 'sql', '001_sabnode_identity.sql'), 'utf8');

const url = process.env.SABNODE_PG_URL;
if (!url) {
  console.error('[apply-identity-schema] SABNODE_PG_URL is not set'); process.exit(1);
}

const pool = new Pool({ connectionString: url });
try {
  console.log('[apply-identity-schema] connecting…');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'sabnode_identity' ORDER BY table_name`,
  );
  client.release();
  console.log('[apply-identity-schema] OK. tables:', rows.map((r) => r.table_name).join(', '));
} catch (err) {
  console.error('[apply-identity-schema] FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
