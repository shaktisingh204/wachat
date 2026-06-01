// PORT-NOTE: pg-migration->mongo-index/seed
// Original: CoreMigrationCheck1764066845539
//
// This Postgres migration updates agent.modelId DEFAULT from 'auto' to
// 'default-smart-model'.
//
// Mongo equivalent: Back-fill existing sabcrm_agent documents where modelId
// is absent or set to the old default 'auto'.

import "server-only";
import { connectToDatabase } from '@/lib/mongodb';

export const migrationId = '1764066845539-coreMigrationCheck';

export const DEFAULT_AGENT_MODEL_ID = 'default-smart-model';

/** Apply the Mongo-equivalent of this migration (idempotent). */
export async function applyMongoMigration(): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection('sabcrm_agent').updateMany(
    {
      $or: [
        { modelId: { $exists: false } },
        { modelId: null },
        { modelId: 'auto' },
      ],
    },
    { $set: { modelId: DEFAULT_AGENT_MODEL_ID } },
  );
}
