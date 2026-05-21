/**
 * QuickBooks Online — persistence helpers.
 *
 * All collections are tenant-scoped via `userId`:
 *   - `crm_quickbooks_settings`   — one row per tenant; tokens + config
 *   - `crm_quickbooks_sync_log`   — append-only, capped at 200 rows / tenant
 */
import 'server-only';

import { ObjectId, type Db } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type {
  QuickBooksSettingDoc,
  QuickBooksSyncLogDoc,
  SyncLogAction,
  SyncLogEntity,
  SyncLogStatus,
} from './types';

export const SETTINGS_COLLECTION = 'crm_quickbooks_settings';
export const SYNC_LOG_COLLECTION = 'crm_quickbooks_sync_log';
export const SYNC_LOG_MAX_PER_TENANT = 200;

export interface DbHandle {
  db: Db;
}

export async function db(): Promise<DbHandle> {
  const { db } = await connectToDatabase();
  return { db };
}

/** Get the tenant's settings doc, or `null` if it doesn't exist yet. */
export async function getSettings(
  userId: ObjectId,
): Promise<QuickBooksSettingDoc | null> {
  const { db } = await connectToDatabase();
  return (await db
    .collection<QuickBooksSettingDoc>(SETTINGS_COLLECTION)
    .findOne({ userId })) as QuickBooksSettingDoc | null;
}

/** Upsert the tenant's settings doc, returning the resulting document. */
export async function upsertSettings(
  userId: ObjectId,
  patch: Partial<Omit<QuickBooksSettingDoc, '_id' | 'userId' | 'createdAt'>>,
): Promise<QuickBooksSettingDoc> {
  const { db } = await connectToDatabase();
  const now = new Date();
  await db.collection<QuickBooksSettingDoc>(SETTINGS_COLLECTION).updateOne(
    { userId },
    {
      $set: { ...patch, updatedAt: now },
      $setOnInsert: { userId, createdAt: now },
    },
    { upsert: true },
  );
  const doc = (await db
    .collection<QuickBooksSettingDoc>(SETTINGS_COLLECTION)
    .findOne({ userId })) as QuickBooksSettingDoc;
  return doc;
}

/**
 * Append a sync-log row and trim the tenant's history to the most recent
 * {@link SYNC_LOG_MAX_PER_TENANT} entries.
 */
export async function appendSyncLog(
  userId: ObjectId,
  entry: Omit<QuickBooksSyncLogDoc, '_id' | 'userId' | 'timestamp'> & {
    action: SyncLogAction;
    entity: SyncLogEntity;
    status: SyncLogStatus;
  },
): Promise<void> {
  try {
    const { db } = await connectToDatabase();
    const doc: QuickBooksSyncLogDoc = {
      ...entry,
      userId,
      timestamp: new Date(),
    };
    await db.collection<QuickBooksSyncLogDoc>(SYNC_LOG_COLLECTION).insertOne(doc);

    // Trim: keep only the latest N rows per tenant.
    const count = await db
      .collection<QuickBooksSyncLogDoc>(SYNC_LOG_COLLECTION)
      .countDocuments({ userId });
    if (count > SYNC_LOG_MAX_PER_TENANT) {
      const toDelete = count - SYNC_LOG_MAX_PER_TENANT;
      const oldest = await db
        .collection<QuickBooksSyncLogDoc>(SYNC_LOG_COLLECTION)
        .find({ userId })
        .sort({ timestamp: 1 })
        .limit(toDelete)
        .project<{ _id: ObjectId }>({ _id: 1 })
        .toArray();
      if (oldest.length > 0) {
        await db
          .collection<QuickBooksSyncLogDoc>(SYNC_LOG_COLLECTION)
          .deleteMany({ _id: { $in: oldest.map((d) => d._id) } });
      }
    }
  } catch (err) {
    // Never let log writes break the actual integration flow.
    console.error('[quickbooks/db] appendSyncLog failed:', err);
  }
}

export async function getRecentSyncLog(
  userId: ObjectId,
  limit = 20,
): Promise<QuickBooksSyncLogDoc[]> {
  const { db } = await connectToDatabase();
  const rows = await db
    .collection<QuickBooksSyncLogDoc>(SYNC_LOG_COLLECTION)
    .find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
  return rows;
}
