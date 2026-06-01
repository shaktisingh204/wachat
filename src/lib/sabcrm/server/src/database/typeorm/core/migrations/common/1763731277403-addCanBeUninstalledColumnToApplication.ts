// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddCanBeUninstalledColumnToApplication1763731277403
//
// This Postgres migration adds:
//   "canBeUninstalled" boolean NOT NULL DEFAULT true
// to the "application" table.
//
// Mongo equivalent: Back-fill existing sabcrm_application documents that lack
// the field with the default value of true.

import "server-only";
import { connectToDatabase } from '@/lib/mongodb';

export const migrationId = '1763731277403-addCanBeUninstalledColumnToApplication';

/** Apply the Mongo-equivalent of this migration (idempotent). */
export async function applyMongoMigration(): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection('sabcrm_application').updateMany(
    { canBeUninstalled: { $exists: false } },
    { $set: { canBeUninstalled: true } },
  );
}
