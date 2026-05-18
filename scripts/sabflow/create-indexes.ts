#!/usr/bin/env -S tsx
/**
 * Standalone script: ensure all SabFlow doc-side Mongo indexes exist.
 *
 *   pnpm db:sabflow:indexes
 *   # or: tsx scripts/sabflow/create-indexes.ts
 *
 * Exits 0 on success, 1 on any failure (connect error, createIndex error,
 * env validation, ...). Safe to run repeatedly — every spec is idempotent.
 *
 * Reuses SabNode's existing Mongo connection helper at `src/lib/mongodb.ts`
 * (native `mongodb` driver, pooled, env-driven).
 */

import { connectToDatabase } from '../../src/lib/mongodb';
import {
  SABFLOW_INDEX_SPECS,
  ensureSabflowIndexes,
} from '../../src/lib/sabflow/persistence/indexes';

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(
    `[sabflow:indexes] starting — ${SABFLOW_INDEX_SPECS.length} index specs queued`,
  );

  const { client, db } = await connectToDatabase();
  // eslint-disable-next-line no-console
  console.log(`[sabflow:indexes] connected to db "${db.databaseName}"`);

  try {
    await ensureSabflowIndexes(db);
  } finally {
    // Close the cached client so the process exits cleanly under tsx.
    await client.close().catch(() => {
      /* ignore — exit path */
    });
  }
}

main()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('[sabflow:indexes] success');
    process.exit(0);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[sabflow:indexes] FAILED:', err);
    process.exit(1);
  });
