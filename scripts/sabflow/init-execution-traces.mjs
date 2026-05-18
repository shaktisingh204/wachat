#!/usr/bin/env node
/**
 * One-shot migration: create indexes for `sabflow_execution_traces`.
 *
 * Phase C.9 · sub-task #2.
 *
 *   node scripts/sabflow/init-execution-traces.mjs
 *
 * Idempotent — MongoDB's `createIndex` is a no-op when an index with the
 * same keys + options already exists. Safe to run repeatedly across
 * environments (dev, preview, prod) without flag-guarding.
 *
 * Index contract (canonical source: src/lib/sabflow/persistence/executionTraces.ts):
 *   - `{ executionId: 1 }`             UNIQUE        — primary lookup
 *   - `{ workspaceId: 1, pinned: 1, expiresAt: 1 }` — workspace-scoped scans
 *   - `{ expiresAt: 1 }`               TTL (0s)      — 30-day non-pinned eviction
 *
 * We deliberately do NOT import the TypeScript module here:
 *   - The TS file is marked `'server-only'`, which throws if loaded outside
 *     a Next.js server context. A standalone migration script is exactly
 *     that — not in a server context.
 *   - This is a one-shot. Re-declaring the three index specs locally keeps
 *     the script dependency-free (`mongodb` + `dotenv` only, both already
 *     in the project).
 *
 * If the index contract ever changes, update BOTH this script and
 * `src/lib/sabflow/persistence/executionTraces.ts::SABFLOW_EXECUTION_TRACES_INDEX_SPECS`.
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';

const LOG = '[sabflow:exec-traces:init]';
const COLLECTION = 'sabflow_execution_traces';

const INDEX_SPECS = [
  {
    keys: { executionId: 1 },
    options: {
      name: 'executionId_1_unique',
      unique: true,
      background: true,
    },
    purpose: 'Primary lookup by execution; unique blocks duplicate trace docs.',
  },
  {
    keys: { workspaceId: 1, pinned: 1, expiresAt: 1 },
    options: {
      name: 'workspaceId_1_pinned_1_expiresAt_1',
      background: true,
    },
    purpose: 'Workspace-scoped scans split by pin state + retention window.',
  },
  {
    keys: { expiresAt: 1 },
    options: {
      name: 'expiresAt_1_ttl',
      // `expireAfterSeconds: 0` → use the field's value as the absolute
      // eviction time. Rows with `expiresAt: null` (pinned) are skipped by
      // Mongo's TTL monitor.
      expireAfterSeconds: 0,
      background: true,
    },
    purpose:
      'TTL: non-pinned trace docs evicted at expiresAt (30d after createdAt).',
  },
];

async function main() {
  if (!process.env.MONGODB_URI || !process.env.MONGODB_DB) {
    console.error(
      `${LOG} MONGODB_URI and MONGODB_DB must be defined in the environment.`,
    );
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    console.log(`${LOG} connected to db "${db.databaseName}"`);

    // Ensure the collection exists — `createIndex` will create it implicitly
    // on first write, but creating it explicitly here makes the script's
    // intent obvious and is itself idempotent (Mongo errors on a duplicate
    // creation, which we swallow as "already there").
    try {
      await db.createCollection(COLLECTION);
      console.log(`${LOG} created collection "${COLLECTION}"`);
    } catch (err) {
      if (err && err.codeName === 'NamespaceExists') {
        console.log(`${LOG} collection "${COLLECTION}" already exists`);
      } else {
        throw err;
      }
    }

    const col = db.collection(COLLECTION);
    const total = INDEX_SPECS.length;

    for (let i = 0; i < total; i++) {
      const spec = INDEX_SPECS[i];
      const label = `${COLLECTION}.${spec.options.name}`;
      console.log(
        `${LOG} (${i + 1}/${total}) creating ${label} — ${spec.purpose}`,
      );
      const result = await col.createIndex(spec.keys, spec.options);
      console.log(`${LOG} (${i + 1}/${total}) ok: ${result}`);
    }

    console.log(`${LOG} done — ${total} indexes ensured`);
  } catch (err) {
    console.error(`${LOG} FAILED:`, err);
    process.exitCode = 1;
  } finally {
    await client.close().catch(() => {
      /* ignore — exit path */
    });
  }
}

main();
