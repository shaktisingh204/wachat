'use strict';

/**
 * Broadcast send (batch) worker.
 *
 * Each job carries:
 *   { broadcastId: string, contactIds: string[] }   // up to BROADCAST_BATCH_SIZE
 *
 * Per job we:
 *   1. Reload the broadcast doc (to pick up cancellation / mps changes).
 *   2. Reload only the contacts that are still PENDING (idempotent: a job
 *      retried after a crash will skip contacts that already shipped).
 *   3. Fan out up to BROADCAST_BATCH_PARALLEL concurrent sends. Each send
 *      first acquires 1 token from the per-broadcast Redis token bucket so
 *      the broadcast's MPS is enforced GLOBALLY across all worker processes.
 *   4. Bulk-write results back: per-contact status, the CRM `contacts`
 *      upsert, and the `outgoing_messages` insert. 3 round trips per batch
 *      instead of ~4 per contact in the legacy worker.
 *   5. Atomically increment the broadcast's success/error counters and, on
 *      reaching contactCount, transition the broadcast to Completed.
 *   6. Re-enqueue any TRANSIENT-failed contacts (up to MAX_RETRIES) with a
 *      delay; PERMANENT-failed contacts are marked FAILED immediately.
 *   7. On RATE_LIMIT responses, the whole batch sleeps once for the longest
 *      retry-after hint and the offending contacts are re-queued.
 */

const { Worker } = require('bullmq');
const { ObjectId } = require('mongodb');
const undici = require('undici');

const { connectToDatabase } = require('./mongo');
const {
  bullConnection,
  redis,
  enqueueBatch,
  BROADCAST_SEND_QUEUE,
} = require('./queue');
const { acquireTokens } = require('./rate-limiter');
const { sendWhatsAppMessage } = require('./send-message');

const LOG_PREFIX = '[BCAST-SEND]';
const PARALLEL = parseInt(process.env.BROADCAST_BATCH_PARALLEL || '64', 10);
const MAX_RETRIES = parseInt(process.env.BROADCAST_MAX_RETRIES || '3', 10);
const RETRY_DELAY_MS = parseInt(process.env.BROADCAST_RETRY_DELAY_MS || '5000', 10);
const DEFAULT_MPS = parseInt(process.env.BROADCAST_DEFAULT_MPS || '80', 10);

// Long-lived undici dispatcher: HTTP keep-alive + pipelining is essential at
// these throughputs. Each worker process keeps its own pool.
const HTTP_AGENT = new undici.Agent({
  connections: parseInt(process.env.BROADCAST_HTTP_CONNECTIONS || '256', 10),
  pipelining: parseInt(process.env.BROADCAST_HTTP_PIPELINING || '4', 10),
  keepAliveTimeout: 30 * 1000,
  keepAliveMaxTimeout: 60 * 1000,
});

/** Tiny p-limit replacement so we don't add a dependency. */
function pLimit(n) {
  let active = 0;
  const queue = [];
  const drain = () => {
    if (active >= n || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve()
      .then(fn)
      .then(
        (v) => { active--; resolve(v); drain(); },
        (e) => { active--; reject(e); drain(); },
      );
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    drain();
  });
}

async function syncSuccessfulSends(db, broadcast, results) {
  // results: [{ contact, sendResult }]
  if (results.length === 0) return;

  const projectObjId = new ObjectId(String(broadcast.projectId));
  const now = new Date();

  // 1) Upsert each unique waId into the project's CRM contacts and grab the ids.
  //    We need the resulting contactId for the outgoing_messages insert, so a
  //    single bulkWrite isn't enough — we need findOneAndUpdate per unique
  //    phone. We dedupe to one upsert per phone within the batch.
  const lastMessage = (
    broadcast.broadcastType === 'flow'
      ? `[Flow]: ${broadcast.flowName || broadcast.templateName}`
      : `[Template]: ${broadcast.templateName}`
  ).substring(0, 50);

  const phoneToContactId = new Map();
  const uniquePhones = new Map(); // phone -> first contact obj
  for (const { contact } of results) {
    if (!uniquePhones.has(contact.phone)) uniquePhones.set(contact.phone, contact);
  }

  await Promise.all(
    Array.from(uniquePhones.values()).map(async (contact) => {
      try {
        // P1-3 fix: `status` moved from $set to $setOnInsert so an existing
        // contact's status (e.g. 'archived', 'vip', 'customer' — whatever the
        // user or CRM set it to) is not wiped back to 'open' every time a
        // broadcast goes out. Only brand-new contacts created by this upsert
        // get the default 'open' status.
        const r = await db.collection('contacts').findOneAndUpdate(
          { projectId: projectObjId, waId: contact.phone },
          {
            $setOnInsert: {
              projectId: projectObjId,
              phoneNumberId: broadcast.phoneNumberId,
              name: contact.name,
              waId: contact.phone,
              createdAt: now,
              status: 'open',
            },
            $set: {
              lastMessage,
              lastMessageTimestamp: now,
            },
          },
          { upsert: true, returnDocument: 'after' },
        );
        const doc = r && (r.value || r);
        if (doc && doc._id) phoneToContactId.set(contact.phone, doc._id);
      } catch (e) {
        // Non-fatal: a CRM upsert failure should not fail the broadcast.
        console.error(`${LOG_PREFIX} contact upsert failed for ${contact.phone}:`, e.message);
      }
    }),
  );

  // 2) Bulk-insert outgoing_messages for everyone whose contactId we resolved.
  //
  // J2 P2 fix: tag each message with broadcastId + sourceType='broadcast' so
  // downstream consumers can correlate replies to the campaign that triggered
  // them. Previously outgoing_messages from the broadcast path looked
  // identical to manual chat sends — there was no way to build a unified
  // contact timeline that said "received Diwali Sale, replied 3h later".
  //
  // templateName / flowName are denormalised onto the message too so the
  // chat UI doesn't need a second query to render "replied to: Diwali Sale".
  const broadcastRef = {
    broadcastId: broadcast._id,
    sourceType: 'broadcast',
    campaignName:
      broadcast.broadcastType === 'flow'
        ? broadcast.flowName || broadcast.templateName || null
        : broadcast.templateName || null,
  };
  const outgoing = [];
  for (const { contact, sendResult } of results) {
    const contactId = phoneToContactId.get(contact.phone);
    if (!contactId) continue;
    const isFlow = broadcast.broadcastType === 'flow';
    outgoing.push({
      direction: 'out',
      contactId,
      projectId: projectObjId,
      wamid: sendResult.messageId,
      messageTimestamp: now,
      type: isFlow ? 'interactive' : 'template',
      content: isFlow
        ? { interactive: sendResult.sentPayload }
        : { template: sendResult.sentPayload },
      status: 'sent',
      statusTimestamps: { sent: now },
      createdAt: now,
      ...broadcastRef,
    });
  }
  if (outgoing.length > 0) {
    try {
      await db.collection('outgoing_messages').insertMany(outgoing, { ordered: false });
    } catch (e) {
      console.error(`${LOG_PREFIX} outgoing_messages insert failed:`, e.message);
    }
  }
}

async function tryFinalize(db, broadcastId, contactCount) {
  // Atomically try to flip a still-PROCESSING broadcast to Completed once
  // every contact has been accounted for.
  const _id = new ObjectId(String(broadcastId));
  const fresh = await db.collection('broadcasts').findOne(
    { _id },
    { projection: { successCount: 1, errorCount: 1, status: 1, contactCount: 1 } },
  );
  if (!fresh) return;
  if (fresh.status !== 'PROCESSING') return;
  const expected = contactCount || fresh.contactCount || 0;
  const done = (fresh.successCount || 0) + (fresh.errorCount || 0);
  if (done < expected) return;

  await db.collection('broadcasts').updateOne(
    { _id, status: 'PROCESSING' },
    { $set: { status: 'Completed', completedAt: new Date() } },
  );
}

async function processSendJob(job) {
  const { broadcastId, contactIds } = job.data;
  if (!ObjectId.isValid(broadcastId)) {
    throw new Error(`Invalid broadcastId: ${broadcastId}`);
  }
  const _id = new ObjectId(broadcastId);
  const { db } = await connectToDatabase();

  const broadcast = await db.collection('broadcasts').findOne({ _id });
  if (!broadcast) return { skipped: true, reason: 'not-found' };
  if (broadcast.status === 'Cancelled') return { skipped: true, reason: 'cancelled' };

  const contactObjIds = contactIds.map((s) => new ObjectId(String(s)));
  const allPendingContacts = await db
    .collection('broadcast_contacts')
    .find({ _id: { $in: contactObjIds }, status: 'PENDING' })
    .toArray();

  if (allPendingContacts.length === 0) {
    return { processed: 0, reason: 'all-already-processed' };
  }

  // P1-3 fix: opt-out compliance. `broadcast_contacts` is an orphan snapshot
  // collection — it does not join back to the canonical `contacts` collection,
  // so a contact who opted out (isOptedOut=true in contacts) can still sit in
  // a broadcast_contacts doc with status=PENDING and get messaged. Before we
  // call the Meta API, look up each phone in the contacts collection and skip
  // any that are opted out. We mark those as FAILED with a specific error so
  // they show up in broadcast analytics and aren't retried.
  const projectObjIdForOptOut = new ObjectId(String(broadcast.projectId));
  const phonesInBatch = Array.from(new Set(allPendingContacts.map((c) => c.phone).filter(Boolean)));
  let optedOutPhones = new Set();
  if (phonesInBatch.length > 0) {
    try {
      const optedOutDocs = await db
        .collection('contacts')
        .find(
          { projectId: projectObjIdForOptOut, waId: { $in: phonesInBatch }, isOptedOut: true },
          { projection: { waId: 1 } },
        )
        .toArray();
      optedOutPhones = new Set(optedOutDocs.map((d) => d.waId));
    } catch (e) {
      console.error(`${LOG_PREFIX} opt-out lookup failed, proceeding without it:`, e.message);
    }
  }

  const contacts = [];
  const skippedOptOutOps = [];
  for (const c of allPendingContacts) {
    if (optedOutPhones.has(c.phone)) {
      skippedOptOutOps.push({
        updateOne: {
          filter: { _id: c._id },
          update: {
            $set: {
              status: 'FAILED',
              error: 'contact_opted_out',
              sentAt: new Date(),
            },
          },
        },
      });
    } else {
      contacts.push(c);
    }
  }

  if (skippedOptOutOps.length > 0) {
    try {
      await db.collection('broadcast_contacts').bulkWrite(skippedOptOutOps, { ordered: false });
      await db.collection('broadcasts').updateOne(
        { _id },
        { $inc: { errorCount: skippedOptOutOps.length } },
      );
      console.log(`${LOG_PREFIX} Skipped ${skippedOptOutOps.length} opted-out recipients for broadcast ${broadcastId}.`);
    } catch (e) {
      console.error(`${LOG_PREFIX} failed to record opt-out skips:`, e.message);
    }
  }

  if (contacts.length === 0) {
    // Everyone in this batch was opted out — still try to finalize the
    // broadcast in case this was the last outstanding batch.
    await tryFinalize(db, broadcastId, broadcast.contactCount);
    return { processed: 0, reason: 'all-opted-out' };
  }

  const mps = Math.max(
    1,
    broadcast.messagesPerSecond ||
      broadcast.projectMessagesPerSecond ||
      DEFAULT_MPS,
  );

  const limit = pLimit(Math.min(PARALLEL, mps * 2));

  // Run sends in parallel; each one blocks on the token bucket so the
  // aggregate request rate cannot exceed `mps` for this broadcast — even
  // across multiple worker processes hitting the same Redis bucket.
  const results = await Promise.all(
    contacts.map((contact) =>
      limit(async () => {
        await acquireTokens(redis, broadcastId, mps, 1);
        const r = await sendWhatsAppMessage(broadcast, contact, HTTP_AGENT);
        return { contact, sendResult: r };
      }),
    ),
  );

  // Build bulk ops + figure out which contacts to retry.
  const bulkOps = [];
  const successResults = [];
  const retryIds = [];
  let success = 0;
  let failed = 0;
  let maxRetryAfterMs = 0;

  for (const { contact, sendResult } of results) {
    if (sendResult.ok) {
      success++;
      successResults.push({ contact, sendResult });
      bulkOps.push({
        updateOne: {
          filter: { _id: contact._id },
          update: {
            $set: {
              status: 'SENT',
              sentAt: new Date(),
              messageId: sendResult.messageId,
              error: null,
            },
          },
        },
      });
      continue;
    }

    const attempts = (contact.attempts || 0) + 1;

    if (sendResult.kind === 'PERMANENT' || attempts >= MAX_RETRIES) {
      failed++;
      bulkOps.push({
        updateOne: {
          filter: { _id: contact._id },
          update: {
            $set: {
              status: 'FAILED',
              error:
                sendResult.kind === 'PERMANENT'
                  ? sendResult.error
                  : `Max retries (${attempts}): ${sendResult.error}`,
              attempts,
            },
          },
        },
      });
      continue;
    }

    // TRANSIENT or RATE_LIMIT: leave PENDING, bump attempts, re-enqueue.
    retryIds.push(contact._id.toString());
    bulkOps.push({
      updateOne: {
        filter: { _id: contact._id },
        update: { $set: { attempts, lastError: sendResult.error } },
      },
    });

    if (sendResult.retryAfterMs && sendResult.retryAfterMs > maxRetryAfterMs) {
      maxRetryAfterMs = sendResult.retryAfterMs;
    }
  }

  if (bulkOps.length > 0) {
    await db.collection('broadcast_contacts').bulkWrite(bulkOps, { ordered: false });
  }

  if (successResults.length > 0) {
    await syncSuccessfulSends(db, broadcast, successResults);
  }

  // Bump aggregate counters atomically. We do this in one $inc per call so
  // a single batch is one Mongo round trip regardless of size.
  if (success > 0 || failed > 0) {
    await db.collection('broadcasts').updateOne(
      { _id },
      { $inc: { successCount: success, errorCount: failed } },
    );
  }

  // Re-enqueue retryable contacts in their own batch with the appropriate delay.
  if (retryIds.length > 0) {
    const delay = Math.max(RETRY_DELAY_MS, maxRetryAfterMs);
    await enqueueBatch(broadcastId, retryIds, { delay });
  }

  // Try to finalize. Cheap when not yet ready.
  await tryFinalize(db, broadcastId, broadcast.contactCount);

  return { sent: success, failed, retried: retryIds.length };
}

function startSendWorker(workerId) {
  const concurrency = parseInt(process.env.BROADCAST_SEND_CONCURRENCY || '16', 10);

  const worker = new Worker(
    BROADCAST_SEND_QUEUE,
    processSendJob,
    {
      connection: bullConnection,
      concurrency,
      lockDuration: 2 * 60 * 1000,
      lockRenewTime: 30 * 1000,
      stalledInterval: 30 * 1000,
      maxStalledCount: 3,
    },
  );

  worker.on('ready', () => {
    console.log(`${LOG_PREFIX} worker ${workerId} ready (concurrency=${concurrency}, parallel=${PARALLEL})`);
  });
  worker.on('failed', (job, err) => {
    console.error(`${LOG_PREFIX} batch ${job?.id} FAILED:`, err?.message);
  });
  worker.on('error', (err) => {
    console.error(`${LOG_PREFIX} worker error:`, err?.message);
  });

  return worker;
}

module.exports = { startSendWorker, processSendJob };
