import "server-only";

/**
 * Redis-backed presence store. One short-TTL key per (workbook, user) holds that user's cursor; it
 * auto-expires ~10s after the last heartbeat, so stale cursors disappear when a tab closes. Listing
 * scans the workbook's keys. Backed by ioredis (same dependency as `worksuite/realtime.ts`).
 */
import IORedis from "ioredis";
import type { PresenceCursor } from "./presence.ts";

const TTL_SECONDS = 10;
let client: IORedis | null = null;

function redis(): IORedis {
  if (!client) {
    client = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: false,
    });
    client.on("error", () => {
      /* presence is best-effort — swallow connection errors */
    });
  }
  return client;
}

const key = (workbookId: string, userId: string) => `sabsheet:presence:${workbookId}:${userId}`;
const pattern = (workbookId: string) => `sabsheet:presence:${workbookId}:*`;

/** Upsert a user's cursor with a fresh TTL. */
export async function setPresence(workbookId: string, cursor: PresenceCursor): Promise<void> {
  try {
    await redis().set(key(workbookId, cursor.userId), JSON.stringify(cursor), "EX", TTL_SECONDS);
  } catch {
    /* best-effort */
  }
}

/** Drop a user's cursor (on disconnect). */
export async function clearPresence(workbookId: string, userId: string): Promise<void> {
  try {
    await redis().del(key(workbookId, userId));
  } catch {
    /* best-effort */
  }
}

/** All active cursors for a workbook, excluding `excludeUserId`. */
export async function listPresence(workbookId: string, excludeUserId: string): Promise<PresenceCursor[]> {
  try {
    const keys = await redis().keys(pattern(workbookId));
    if (keys.length === 0) return [];
    const values = await redis().mget(keys);
    const out: PresenceCursor[] = [];
    for (const v of values) {
      if (!v) continue;
      try {
        const c = JSON.parse(v) as PresenceCursor;
        if (c.userId !== excludeUserId) out.push(c);
      } catch {
        /* skip malformed */
      }
    }
    return out;
  } catch {
    return [];
  }
}
