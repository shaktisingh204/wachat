// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddFastAndSmartModelsToWorkspace1763997530458
//
// This Postgres migration adds two NOT NULL columns with defaults to "workspace":
//   - "fastModel"  character varying NOT NULL DEFAULT 'default-fast-model'
//   - "smartModel" character varying NOT NULL DEFAULT 'default-smart-model'
//
// Mongo equivalent: Back-fill existing sabcrm_workspace documents.

import "server-only";
import { connectToDatabase } from '@/lib/mongodb';

export const migrationId = '1763997530458-AddFastAndSmartModelsToWorkspace';

export const DEFAULT_FAST_MODEL = 'default-fast-model';
export const DEFAULT_SMART_MODEL = 'default-smart-model';

/** Apply the Mongo-equivalent of this migration (idempotent). */
export async function applyMongoMigration(): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection('sabcrm_workspace').updateMany(
    {
      $or: [
        { fastModel: { $exists: false } },
        { smartModel: { $exists: false } },
      ],
    },
    {
      $set: {
        fastModel: DEFAULT_FAST_MODEL,
        smartModel: DEFAULT_SMART_MODEL,
      },
    },
  );
}
