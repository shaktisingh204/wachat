'use strict';

/**
 * Broadcast control worker.
 *
 * Pops one job per broadcast off the `broadcast-control` queue and:
 *   1. Marks the broadcast PROCESSING (idempotent — survives restarts).
 *   2. Uploads any header media to Meta exactly once and stores the media id.
 *   3. Streams broadcast_contacts via a sorted Mongo cursor (by _id ascending),
 *      grouping into BROADCAST_BATCH_SIZE batches and enqueuing each batch as
 *      a `send-batch` job on the `broadcast-send` queue.
 *   4. Checkpoints `lastEnqueuedContactId` periodically so a crash resumes
 *      from where it left off instead of double-enqueueing the whole list.
 *   5. Honors mid-flight cancellation (broadcast.status === 'Cancelled').
 *
 * Memory profile: O(BATCH_SIZE) regardless of total contact count, so a
 * broadcast with 1,000,000 contacts is bounded the same as one with 1,000.
 */

const { Worker } = require('bullmq');
const { ObjectId } = require('mongodb');
const undici = require('undici');
const FormData = require('form-data');

const { connectToDatabase } = require('./mongo');
const {
  bullConnection,
  enqueueBatch,
  BROADCAST_CONTROL_QUEUE,
} = require('./queue');

const LOG_PREFIX = '[BCAST-CONTROL]';
const BATCH_SIZE = parseInt(process.env.BROADCAST_BATCH_SIZE || '200', 10);
const CHECKPOINT_EVERY = parseInt(process.env.BROADCAST_CHECKPOINT_EVERY || '10', 10);
const CANCEL_CHECK_EVERY = parseInt(process.env.BROADCAST_CANCEL_CHECK_EVERY || '50', 10);
const API_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';

async function logBroadcast(db, broadcastId, projectId, level, message) {
  try {
    await db.collection('broadcast_logs').insertOne({
      broadcastId: new ObjectId(String(broadcastId)),
      projectId: new ObjectId(String(projectId)),
      level,
      message,
      timestamp: new Date(),
    });
  } catch (e) {
    console.error(`${LOG_PREFIX} log write failed`, e);
  }
}

async function uploadHeaderMediaIfNeeded(db, broadcast) {
  if (!broadcast.headerMediaFile || broadcast.headerMediaId) return null;

  const { buffer, name, type } = broadcast.headerMediaFile;
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('file', Buffer.from(buffer.buffer || buffer), {
    filename: name,
    contentType: type,
  });

  const res = await undici.request(
    `https://graph.facebook.com/${API_VERSION}/${broadcast.phoneNumberId}/media`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${broadcast.accessToken}`,
        ...form.getHeaders(),
      },
      body: form.getBuffer(),
      bodyTimeout: 60000,
      headersTimeout: 60000,
    },
  );

  const body = await res.body.json();
  if (!body || !body.id) {
    throw new Error(`Media upload failed: ${JSON.stringify(body).substring(0, 300)}`);
  }

  const mediaType = type.startsWith('video')
    ? 'VIDEO'
    : type.startsWith('image')
      ? 'IMAGE'
      : 'DOCUMENT';

  await db.collection('broadcasts').updateOne(
    { _id: broadcast._id },
    {
      $set: {
        headerMediaId: body.id,
        headerMediaType: mediaType,
        headerMediaUploadedAt: new Date(),
      },
    },
  );

  return { id: body.id, type: mediaType };
}

async function processControlJob(job, workerId) {
  const broadcastId = String(job.data.broadcastId);
  if (!ObjectId.isValid(broadcastId)) {
    throw new Error(`Invalid broadcastId: ${broadcastId}`);
  }
  const _id = new ObjectId(broadcastId);
  const { db } = await connectToDatabase();

  const broadcast = await db.collection('broadcasts').findOne({ _id });
  if (!broadcast) {
    console.warn(`${LOG_PREFIX} broadcast ${broadcastId} not found`);
    return { skipped: true, reason: 'not-found' };
  }
  if (['Completed', 'Cancelled', 'FAILED_PROCESSING'].includes(broadcast.status)) {
    return { skipped: true, reason: broadcast.status };
  }

  // Take ownership idempotently. We allow re-claiming jobs that crashed mid-flight.
  await db.collection('broadcasts').updateOne(
    { _id },
    {
      $set: {
        status: 'PROCESSING',
        startedAt: broadcast.startedAt || new Date(),
        controlWorkerId: workerId,
        lastControlPickupAt: new Date(),
      },
    },
  );

  await logBroadcast(db, _id, broadcast.projectId, 'INFO',
    `Control worker ${workerId} picked up broadcast (resume=${!!broadcast.lastEnqueuedContactId})`);

  // One-shot media upload (skipped on resume because we persist the id).
  if (broadcast.headerMediaFile && !broadcast.headerMediaId) {
    try {
      const uploaded = await uploadHeaderMediaIfNeeded(db, broadcast);
      if (uploaded) {
        broadcast.headerMediaId = uploaded.id;
        broadcast.headerMediaType = uploaded.type;
        await logBroadcast(db, _id, broadcast.projectId, 'INFO',
          `Header media uploaded: ${uploaded.id}`);
      }
    } catch (e) {
      const msg = e.message || String(e);
      await db.collection('broadcasts').updateOne(
        { _id },
        { $set: { status: 'FAILED_PROCESSING', error: `Media upload failed: ${msg}` } },
      );
      await logBroadcast(db, _id, broadcast.projectId, 'ERROR', `Media upload failed: ${msg}`);
      return { failed: true, error: msg };
    }
  }

  // Resume cursor: pick up where the last checkpoint left off.
  const filter = { broadcastId: _id, status: 'PENDING' };
  if (broadcast.lastEnqueuedContactId && ObjectId.isValid(broadcast.lastEnqueuedContactId)) {
    filter._id = { $gt: new ObjectId(broadcast.lastEnqueuedContactId) };
  }

  const cursor = db
    .collection('broadcast_contacts')
    .find(filter, { projection: { _id: 1 } })
    .sort({ _id: 1 })
    .batchSize(2000);

  let buf = [];
  let totalEnqueued = broadcast.enqueuedCount || 0;
  let lastId = broadcast.lastEnqueuedContactId
    ? new ObjectId(broadcast.lastEnqueuedContactId)
    : null;
  let batchesEnqueuedSinceCheckpoint = 0;
  let batchesEnqueuedSinceCancelCheck = 0;

  try {
    for await (const doc of cursor) {
      buf.push(doc._id);
      lastId = doc._id;

      if (buf.length >= BATCH_SIZE) {
        await enqueueBatch(broadcastId, buf);
        totalEnqueued += buf.length;
        buf = [];
        batchesEnqueuedSinceCheckpoint++;
        batchesEnqueuedSinceCancelCheck++;

        if (batchesEnqueuedSinceCheckpoint >= CHECKPOINT_EVERY) {
          await db.collection('broadcasts').updateOne(
            { _id },
            { $set: { lastEnqueuedContactId: lastId, enqueuedCount: totalEnqueued } },
          );
          batchesEnqueuedSinceCheckpoint = 0;
        }

        if (batchesEnqueuedSinceCancelCheck >= CANCEL_CHECK_EVERY) {
          batchesEnqueuedSinceCancelCheck = 0;
          const fresh = await db
            .collection('broadcasts')
            .findOne({ _id }, { projection: { status: 1 } });
          if (fresh && fresh.status === 'Cancelled') {
            await cursor.close();
            await logBroadcast(db, _id, broadcast.projectId, 'WARN',
              `Cancellation detected after enqueueing ${totalEnqueued} contacts`);
            return { cancelled: true, enqueued: totalEnqueued };
          }
        }
      }
    }

    if (buf.length > 0) {
      await enqueueBatch(broadcastId, buf);
      totalEnqueued += buf.length;
    }
  } finally {
    try { await cursor.close(); } catch (_) {}
  }

  await db.collection('broadcasts').updateOne(
    { _id },
    {
      $set: {
        lastEnqueuedContactId: lastId,
        enqueuedCount: totalEnqueued,
        allEnqueuedAt: new Date(),
      },
    },
  );

  await logBroadcast(db, _id, broadcast.projectId, 'INFO',
    `All ${totalEnqueued} contacts enqueued in batches of ${BATCH_SIZE}`);

  return { enqueued: totalEnqueued };
}

function startControlWorker(workerId) {
  const concurrency = parseInt(process.env.BROADCAST_CONTROL_CONCURRENCY || '50', 10);

  const worker = new Worker(
    BROADCAST_CONTROL_QUEUE,
    (job) => processControlJob(job, workerId),
    {
      connection: bullConnection,
      concurrency,
      // Lock the job for long enough that streaming a 1M-contact cursor on a
      // slow Mongo cluster cannot lose its lease mid-flight.
      lockDuration: 5 * 60 * 1000,        // 5 min
      lockRenewTime: 60 * 1000,           // renew every 1 min
      stalledInterval: 60 * 1000,
      maxStalledCount: 2,
    },
  );

  worker.on('ready', () => {
    console.log(`${LOG_PREFIX} worker ${workerId} ready (concurrency=${concurrency})`);
  });
  worker.on('failed', (job, err) => {
    console.error(`${LOG_PREFIX} job ${job?.id} FAILED:`, err?.message);
  });
  worker.on('error', (err) => {
    console.error(`${LOG_PREFIX} worker error:`, err?.message);
  });

  return worker;
}

module.exports = { startControlWorker, processControlJob };
