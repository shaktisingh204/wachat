'use strict';

/**
 * Lightweight Mongo connection for the broadcast workers.
 *
 * Mirrors src/lib/mongodb.ts but is plain CommonJS so PM2 can boot the
 * worker without going through the Next.js build pipeline.
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

if (!MONGODB_URI || !MONGODB_DB) {
  throw new Error('Missing MONGODB_URI / MONGODB_DB');
}

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return { client: cachedClient, db: cachedDb };

  const client = new MongoClient(MONGODB_URI, {
    // Larger pool than the legacy worker (10) — the new send worker fans out
    // dozens of concurrent batches, each doing 2-3 round trips.
    maxPoolSize: 60,
    minPoolSize: 5,
    retryWrites: true,
  });
  await client.connect();

  cachedClient = client;
  cachedDb = client.db(MONGODB_DB);
  return { client: cachedClient, db: cachedDb };
}

module.exports = { connectToDatabase };
