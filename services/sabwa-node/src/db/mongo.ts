/**
 * MongoDB connection helper for sabwa-node.
 *
 * Resolves to a `{ client, db }` pair. The database name is taken from the
 * connection-string path component when present (e.g. `…/sabnode`), falling
 * back to `sabnode` to match the Rust engine's default (`MONGODB_DB`).
 *
 * Collection prefix convention (same as the Rust engine — kept identical so
 * the migration is a drop-in replacement):
 *   sabwa_sessions, sabwa_chats, sabwa_messages, sabwa_contacts,
 *   sabwa_groups, sabwa_scheduled, sabwa_templates, sabwa_quick_replies,
 *   sabwa_auto_replies, sabwa_broadcasts, sabwa_labels, sabwa_webhooks,
 *   sabwa_api_keys, sabwa_audit_log, sabwa_group_categories.
 */

import { MongoClient, type Db } from 'mongodb';
import type { Logger } from '../log.js';

const DEFAULT_DB_NAME = 'sabnode';

export interface MongoHandles {
  client: MongoClient;
  db: Db;
}

/** Extract the database name from a Mongo URI's path, defaulting to `sabnode`. */
function dbNameFromUri(uri: string): string {
  try {
    // URL doesn't fully parse `mongodb://` schemes pre-Node 20 in all cases,
    // but a manual split on the last `/` before any `?` is robust enough.
    const noQuery = uri.split('?')[0] ?? uri;
    const tail = noQuery.split('/').pop();
    if (tail && tail.length > 0 && !tail.includes(':')) return tail;
  } catch {
    /* fall through */
  }
  return DEFAULT_DB_NAME;
}

/**
 * Connect to MongoDB and return the live client + default db handle.
 * Caller is responsible for calling `client.close()` on shutdown.
 */
export async function connectMongo(uri: string, log: Logger): Promise<MongoHandles> {
  const client = new MongoClient(uri, {
    // Conservative pool sized for a single worker process; tune via env later.
    maxPoolSize: 20,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 10_000,
  });

  await client.connect();
  const name = dbNameFromUri(uri);
  const db = client.db(name);

  // Ping to fail fast if auth/network is wrong.
  await db.command({ ping: 1 });
  log.info({ db: name }, 'mongo connected');

  return { client, db };
}
