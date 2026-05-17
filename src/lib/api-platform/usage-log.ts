/**
 * Fire-and-forget request log writer for the developer API.
 *
 * Every `withApiV1`-wrapped handler calls `logApiRequest(...)` after the
 * response is built. The write goes to a capped/TTL'd Mongo collection
 * (`apiRequestLog`) so dashboards and per-key analytics can query
 * without re-instrumenting every endpoint.
 *
 * Reads are served by the Rust `developer-api-usage` crate; this module
 * is write-only and never blocks the request path — Mongo errors are
 * swallowed with a console.warn.
 *
 * Collection layout:
 *
 *   {
 *     _id:        ObjectId,
 *     tenantId:   string,
 *     keyId:      string,
 *     kind:       'api_key' | 'pat' | 'oauth',
 *     env:        'live' | 'test',
 *     method:     string,           // 'GET', 'POST', ...
 *     path:       string,           // '/api/v1/...'
 *     status:     number,
 *     latencyMs:  number,
 *     requestId:  string,
 *     userAgent?: string,
 *     ip?:        string,
 *     errorType?: string,           // when status >= 400
 *     ts:         Date,             // also the TTL index field
 *   }
 *
 * TTL: 30 days. Created lazily on first write to avoid a startup
 * dependency on connectToDatabase.
 */

import 'server-only';

import { connectToDatabase } from '@/lib/mongodb';

const COLLECTION = 'apiRequestLog';
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

let indexEnsured = false;

async function ensureIndexes(): Promise<void> {
  if (indexEnsured) return;
  try {
    const { db } = await connectToDatabase();
    const col = db.collection(COLLECTION);
    await col.createIndex({ ts: 1 }, { expireAfterSeconds: TTL_SECONDS, background: true });
    await col.createIndex({ tenantId: 1, ts: -1 }, { background: true });
    await col.createIndex({ tenantId: 1, keyId: 1, ts: -1 }, { background: true });
    await col.createIndex({ tenantId: 1, path: 1, ts: -1 }, { background: true });
    indexEnsured = true;
  } catch (err) {
    // Don't loop on failure — flip the flag so we don't retry hot.
    console.warn('[api-platform] usage-log index ensure failed:', err);
    indexEnsured = true;
  }
}

export interface ApiRequestLogEntry {
  tenantId: string;
  keyId: string;
  kind: 'api_key' | 'pat' | 'oauth';
  env: 'live' | 'test';
  method: string;
  path: string;
  status: number;
  latencyMs: number;
  requestId: string;
  userAgent?: string;
  ip?: string;
  errorType?: string;
}

/**
 * Append one row to `apiRequestLog`. Never throws — Mongo errors are
 * logged and swallowed so a logging outage cannot 500 the API.
 */
export function logApiRequest(entry: ApiRequestLogEntry): void {
  void (async () => {
    try {
      await ensureIndexes();
      const { db } = await connectToDatabase();
      await db.collection(COLLECTION).insertOne({
        ...entry,
        ts: new Date(),
      });
    } catch (err) {
      console.warn('[api-platform] usage-log insert failed:', err);
    }
  })();
}
