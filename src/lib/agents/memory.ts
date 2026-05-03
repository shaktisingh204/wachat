/**
 * Agent memory.
 *
 * Short-term memory is a per-run LRU map (in RAM) attached to the run context.
 * Long-term memory is stored in Mongo collection `agent_memories`, scoped by
 * `namespace` (typically the agent id) and `tenantId`.
 */

import 'server-only';
import { connectToDatabase } from '@/lib/mongodb';

const COLLECTION = 'agent_memories';

export interface AgentMemoryRow {
  _id?: unknown;
  namespace: string;
  tenantId?: string;
  key: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
  /** Optional TTL marker for cleanup. */
  expiresAt?: Date;
}

/**
 * LRU-evicting Map for short-term memory. Insertion order is the recency
 * order, so we re-set on read to bump.
 */
export class ShortTermMemory<V = unknown> {
  private readonly map: Map<string, V>;
  constructor(private readonly limit: number = 64) {
    this.map = new Map();
  }

  get(key: string): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key) as V;
    // Refresh recency.
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.limit) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, value);
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  size(): number {
    return this.map.size;
  }

  /** Expose as a regular Map so it can be passed through context. */
  asMap(): Map<string, V> {
    return this.map;
  }
}

/** Persist a long-term memory row. Upserts on (namespace, tenantId, key). */
export async function rememberLongTerm(
  namespace: string,
  key: string,
  value: unknown,
  options: { tenantId?: string; expiresAt?: Date } = {},
): Promise<void> {
  const { db } = await connectToDatabase();
  const now = new Date();
  await db.collection<AgentMemoryRow>(COLLECTION).updateOne(
    { namespace, tenantId: options.tenantId, key },
    {
      $set: {
        namespace,
        tenantId: options.tenantId,
        key,
        value,
        updatedAt: now,
        expiresAt: options.expiresAt,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

/** Recall a single long-term memory row. */
export async function recallLongTerm(
  namespace: string,
  key: string,
  options: { tenantId?: string } = {},
): Promise<unknown | undefined> {
  const { db } = await connectToDatabase();
  const row = await db
    .collection<AgentMemoryRow>(COLLECTION)
    .findOne({ namespace, tenantId: options.tenantId, key });
  if (!row) return undefined;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return undefined;
  return row.value;
}

/** List recent long-term memory rows for a namespace. */
export async function listLongTerm(
  namespace: string,
  options: { tenantId?: string; limit?: number } = {},
): Promise<AgentMemoryRow[]> {
  const { db } = await connectToDatabase();
  const limit = Math.max(1, Math.min(options.limit ?? 50, 500));
  return db
    .collection<AgentMemoryRow>(COLLECTION)
    .find({ namespace, tenantId: options.tenantId })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
}

/** Forget a single long-term row. */
export async function forgetLongTerm(
  namespace: string,
  key: string,
  options: { tenantId?: string } = {},
): Promise<boolean> {
  const { db } = await connectToDatabase();
  const res = await db
    .collection<AgentMemoryRow>(COLLECTION)
    .deleteOne({ namespace, tenantId: options.tenantId, key });
  return res.deletedCount === 1;
}
