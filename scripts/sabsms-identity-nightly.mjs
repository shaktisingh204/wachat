#!/usr/bin/env node
/**
 * SabSMS V2.10 — identity-graph nightly maintenance (`sabsms_identities`).
 *
 * Two jobs, in order:
 *
 *   1. RECOMPUTE the 30-day engagement counters (`inbound30d`,
 *      `clicks30d`, `delivered30d`) from the raw collections. The live
 *      consumer's `$inc` path is at-least-once AND never decays — without
 *      this job the "30d" counters are actually "since first touch".
 *      Recompute = reset every identity's counters to 0, then write the
 *      true last-30-days sums (inbound/delivered grouped by phone from
 *      `sabsms_messages`; clicks grouped by contactId from
 *      `sabsms_link_clicks`, joined via the identity's `contactIds`).
 *
 *   2. DECAY the 24-bucket UTC send-time histogram ×0.95 so old
 *      engagement habits fade and `bestSendHourUtc` tracks current
 *      behaviour. Buckets below 0.01 snap to 0 to stop float dust.
 *
 *   Both steps only UPDATE existing identity docs — creating identities
 *   is the events consumer's job. Idempotent per night; running twice
 *   simply decays twice (which is why it's scheduled, not looped).
 *
 * Run under tsx (same interop pattern as scripts/sabsms-events-worker.mjs):
 *
 *   NODE_PATH=./src/workers/_stubs ./node_modules/.bin/tsx \
 *     scripts/sabsms-identity-nightly.mjs [--dry-run]
 *
 * PM2 nightly registration (02:30 UTC, run-to-completion):
 *
 *   pm2 start ./node_modules/.bin/tsx \
 *     --name sabsms-identity-nightly \
 *     --cron-restart "30 2 * * *" --no-autorestart -- \
 *     scripts/sabsms-identity-nightly.mjs
 *
 * Required env: MONGODB_URI (or MONGO_URL) + optional MONGODB_DB
 * (default `sabnode`).
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';

// Default-import + destructure — tsx CommonJS interop (see the events worker).
import graphModule from '../src/lib/sabsms/identity/graph.ts';

const { SABSMS_IDENTITIES_COLLECTION, ensureIdentityIndexes, phoneHashFor } =
  graphModule;

const DRY_RUN = process.argv.includes('--dry-run');
const WINDOW_DAYS = 30;
const DECAY = 0.95;
const BULK_CHUNK = 1_000;

const uri = process.env.MONGODB_URI || process.env.MONGO_URL || '';
if (!uri) {
  console.error('[identity-nightly] MONGODB_URI is not set');
  process.exit(1);
}

const client = new MongoClient(uri, { maxPoolSize: 4 });
await client.connect();
const db = client.db(process.env.MONGODB_DB || 'sabnode');
const identities = db.collection(SABSMS_IDENTITIES_COLLECTION);

const startedAt = Date.now();
const cut = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

/** Flush a phoneHash-keyed counter map as chunked bulk `$set`s. */
async function flushByPhoneHash(field, byWsHash) {
  let ops = [];
  let updated = 0;
  for (const [key, count] of byWsHash) {
    const idx = key.indexOf('|');
    const workspaceId = key.slice(0, idx);
    const phoneHash = key.slice(idx + 1);
    ops.push({
      updateOne: {
        filter: { workspaceId, phoneHash },
        update: { $set: { [field]: count, updatedAt: new Date() } },
      },
    });
    if (ops.length >= BULK_CHUNK) {
      const res = await identities.bulkWrite(ops, { ordered: false });
      updated += res.modifiedCount;
      ops = [];
    }
  }
  if (ops.length > 0) {
    const res = await identities.bulkWrite(ops, { ordered: false });
    updated += res.modifiedCount;
  }
  return updated;
}

try {
  await ensureIdentityIndexes(db);

  // ── 1a. Reset the 30d counters on every identity. ───────────────────
  let reset = 0;
  if (!DRY_RUN) {
    const res = await identities.updateMany(
      {},
      {
        $set: {
          'engagement.inbound30d': 0,
          'engagement.clicks30d': 0,
          'engagement.delivered30d': 0,
        },
      },
    );
    reset = res.modifiedCount;
  }

  // ── 1b. inbound30d — inbound messages in the window, by `from`. ─────
  const inboundByKey = new Map();
  for await (const row of db.collection('sabsms_messages').aggregate(
    [
      { $match: { direction: 'inbound', createdAt: { $gte: cut } } },
      { $group: { _id: { ws: '$workspaceId', phone: '$from' }, n: { $sum: 1 } } },
    ],
    { allowDiskUse: true },
  )) {
    const ws = String(row._id?.ws ?? '');
    const phone = String(row._id?.phone ?? '');
    if (!ws || !phone) continue;
    inboundByKey.set(`${ws}|${phoneHashFor(phone)}`, Number(row.n ?? 0));
  }
  const inboundUpdated = DRY_RUN ? 0 : await flushByPhoneHash('engagement.inbound30d', inboundByKey);

  // ── 1c. delivered30d — outbound deliveries in the window, by `to`. ──
  const deliveredByKey = new Map();
  for await (const row of db.collection('sabsms_messages').aggregate(
    [
      { $match: { direction: 'outbound', deliveredAt: { $gte: cut } } },
      { $group: { _id: { ws: '$workspaceId', phone: '$to' }, n: { $sum: 1 } } },
    ],
    { allowDiskUse: true },
  )) {
    const ws = String(row._id?.ws ?? '');
    const phone = String(row._id?.phone ?? '');
    if (!ws || !phone) continue;
    deliveredByKey.set(`${ws}|${phoneHashFor(phone)}`, Number(row.n ?? 0));
  }
  const deliveredUpdated = DRY_RUN
    ? 0
    : await flushByPhoneHash('engagement.delivered30d', deliveredByKey);

  // ── 1d. clicks30d — link clicks in the window, joined by contactId
  //        (click docs carry no phone; identities index their contactIds). ──
  let clicksUpdated = 0;
  const clickOps = [];
  for await (const row of db.collection('sabsms_link_clicks').aggregate(
    [
      {
        $match: {
          clickedAt: { $gte: cut },
          contactId: { $exists: true, $nin: [null, ''] },
        },
      },
      {
        $group: {
          _id: { ws: '$workspaceId', contactId: '$contactId' },
          n: { $sum: 1 },
        },
      },
    ],
    { allowDiskUse: true },
  )) {
    const ws = String(row._id?.ws ?? '');
    const contactId = String(row._id?.contactId ?? '');
    if (!ws || !contactId) continue;
    clickOps.push({
      updateMany: {
        filter: { workspaceId: ws, contactIds: contactId },
        update: {
          $inc: { 'engagement.clicks30d': Number(row.n ?? 0) },
          $set: { updatedAt: new Date() },
        },
      },
    });
  }
  if (!DRY_RUN) {
    for (let i = 0; i < clickOps.length; i += BULK_CHUNK) {
      const res = await identities.bulkWrite(clickOps.slice(i, i + BULK_CHUNK), {
        ordered: false,
      });
      clicksUpdated += res.modifiedCount;
    }
  }

  // ── 2. Histogram decay ×0.95 (pipeline update; dust < 0.01 → 0). ────
  let decayed = 0;
  if (!DRY_RUN) {
    const res = await identities.updateMany(
      { sendTimeHistogram: { $exists: true, $type: 'array' } },
      [
        {
          $set: {
            sendTimeHistogram: {
              $map: {
                input: '$sendTimeHistogram',
                in: {
                  $let: {
                    vars: { v: { $multiply: ['$$this', DECAY] } },
                    in: {
                      $cond: [
                        { $lt: ['$$v', 0.01] },
                        0,
                        { $round: ['$$v', 4] },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      ],
    );
    decayed = res.modifiedCount;
  }

  console.log(
    `[identity-nightly] done: reset=${reset} inbound=${inboundByKey.size} groups (${inboundUpdated} updated) ` +
      `delivered=${deliveredByKey.size} groups (${deliveredUpdated} updated) ` +
      `clicks=${clickOps.length} groups (${clicksUpdated} updated) decayed=${decayed} ` +
      `dryRun=${DRY_RUN} in ${Math.round((Date.now() - startedAt) / 1000)}s`,
  );
} catch (err) {
  console.error('[identity-nightly] failed', err);
  process.exitCode = 1;
} finally {
  await client.close().catch(() => undefined);
}
