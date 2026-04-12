'use strict';
/**
 * Wachat J1/J2 P2 migration — run manually from the project root.
 *
 *   node scripts/wachat-index-and-dedup-migration.js            # dry-run
 *   node scripts/wachat-index-and-dedup-migration.js --apply    # actually modify
 *
 * This script does three things, in order:
 *
 *   1) Dedupe `incoming_messages` by `wamid` (required before step 2).
 *      The old webhook-processor batch path did insertMany with no idempotency,
 *      so existing data likely contains duplicate wamids from Meta retries.
 *      A unique index build will fail until this is done. Keeps the oldest row
 *      per `(projectId, wamid)` and deletes the rest.
 *
 *   2) Creates a unique index on `incoming_messages(projectId, wamid)`, partial
 *      so documents without wamid don't conflict. After this, future concurrent
 *      webhook retries cannot produce duplicate rows even if they race past the
 *      app-level pre-check.
 *
 *   3) Creates the P2 read-path indexes nominated in the audit:
 *        - incoming_messages(projectId, contactId, messageTimestamp)
 *        - outgoing_messages(projectId, contactId, messageTimestamp)
 *        - outgoing_messages(wamid)          — unique, sparse
 *        - broadcast_contacts(broadcastId, status)
 *
 * All operations are idempotent — running it twice is safe.
 *
 * Run in dry-run mode first, review the output, then re-run with --apply.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const LOG_PREFIX = '[WACHAT-MIGRATE]';
const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`${LOG_PREFIX} Starting ${APPLY ? 'APPLY' : 'DRY-RUN'} migration...`);

  if (!process.env.MONGODB_URI || !process.env.MONGODB_DB) {
    console.error(`${LOG_PREFIX} MONGODB_URI and MONGODB_DB must be defined in .env file.`);
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    console.log(`${LOG_PREFIX} Connected to database: ${process.env.MONGODB_DB}`);

    // ------------------------------------------------------------------
    // Step 1: Dedupe incoming_messages by (projectId, wamid)
    // ------------------------------------------------------------------
    console.log(`\n${LOG_PREFIX} [1/3] Scanning incoming_messages for duplicate wamids...`);
    const dupes = await db.collection('incoming_messages').aggregate([
      { $match: { wamid: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: { projectId: '$projectId', wamid: '$wamid' },
          ids: { $push: '$_id' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ], { allowDiskUse: true }).toArray();

    if (dupes.length === 0) {
      console.log(`${LOG_PREFIX}   No duplicates found — collection is already clean.`);
    } else {
      const totalExtras = dupes.reduce((sum, d) => sum + (d.count - 1), 0);
      console.log(`${LOG_PREFIX}   Found ${dupes.length} wamid groups with duplicates (${totalExtras} extra rows to delete)`);
      console.log(`${LOG_PREFIX}   Example duplicate groups (first 5):`);
      for (const d of dupes.slice(0, 5)) {
        console.log(`${LOG_PREFIX}     wamid=${d._id.wamid} projectId=${d._id.projectId} count=${d.count}`);
      }

      if (APPLY) {
        let deleted = 0;
        for (const d of dupes) {
          // Keep the oldest row (lowest _id, since ObjectIds are time-ordered)
          // and delete the rest.
          const sorted = d.ids.slice().sort((a, b) => (a.toString() < b.toString() ? -1 : 1));
          const toDelete = sorted.slice(1);
          const res = await db.collection('incoming_messages').deleteMany({ _id: { $in: toDelete } });
          deleted += res.deletedCount;
        }
        console.log(`${LOG_PREFIX}   Deleted ${deleted} duplicate rows, kept the oldest per group.`);
      } else {
        console.log(`${LOG_PREFIX}   DRY-RUN — no rows deleted. Re-run with --apply to execute.`);
      }
    }

    // ------------------------------------------------------------------
    // Step 2: Unique index on incoming_messages(projectId, wamid)
    // ------------------------------------------------------------------
    console.log(`\n${LOG_PREFIX} [2/3] Ensuring unique index on incoming_messages(projectId, wamid)...`);
    if (APPLY) {
      try {
        const name = await db.collection('incoming_messages').createIndex(
          { projectId: 1, wamid: 1 },
          {
            unique: true,
            name: 'uniq_projectId_wamid',
            // Only index docs that actually have a wamid — legacy rows without
            // one don't conflict.
            partialFilterExpression: { wamid: { $exists: true, $type: 'string' } },
          },
        );
        console.log(`${LOG_PREFIX}   Index created / already exists: ${name}`);
      } catch (err) {
        console.error(`${LOG_PREFIX}   FAILED to create unique index:`, err.message);
        console.error(`${LOG_PREFIX}   This usually means step 1's dedup didn't catch everything.`);
        console.error(`${LOG_PREFIX}   Re-run step 1 with --apply, then retry.`);
        throw err;
      }
    } else {
      console.log(`${LOG_PREFIX}   DRY-RUN — index not created. Re-run with --apply to execute.`);
    }

    // ------------------------------------------------------------------
    // Step 3: Read-path P2 indexes
    // ------------------------------------------------------------------
    console.log(`\n${LOG_PREFIX} [3/3] Ensuring P2 read-path indexes...`);
    const p2Indexes = [
      {
        collection: 'incoming_messages',
        spec: { projectId: 1, contactId: 1, messageTimestamp: 1 },
        options: { name: 'proj_contact_ts' },
      },
      {
        collection: 'outgoing_messages',
        spec: { projectId: 1, contactId: 1, messageTimestamp: 1 },
        options: { name: 'proj_contact_ts' },
      },
      {
        collection: 'outgoing_messages',
        spec: { wamid: 1 },
        options: {
          name: 'uniq_wamid',
          unique: true,
          partialFilterExpression: { wamid: { $exists: true, $type: 'string' } },
        },
      },
      {
        collection: 'broadcast_contacts',
        spec: { broadcastId: 1, status: 1 },
        options: { name: 'broadcast_status' },
      },
    ];

    for (const idx of p2Indexes) {
      const label = `${idx.collection}(${Object.keys(idx.spec).join(',')})`;
      if (APPLY) {
        try {
          const name = await db.collection(idx.collection).createIndex(idx.spec, idx.options);
          console.log(`${LOG_PREFIX}   ${label} → ${name}`);
        } catch (err) {
          console.error(`${LOG_PREFIX}   ${label} FAILED:`, err.message);
          // Don't rethrow — try the rest. Unique index on outgoing_messages.wamid
          // might fail if dupes exist there (same root cause). Log and continue.
        }
      } else {
        console.log(`${LOG_PREFIX}   ${label} (DRY-RUN)`);
      }
    }

    console.log(`\n${LOG_PREFIX} Migration ${APPLY ? 'completed' : 'dry-run completed'}.`);
    if (!APPLY) {
      console.log(`${LOG_PREFIX} Re-run with --apply to execute for real.`);
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Migration failed:`, err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();
