import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: This was a TypeORM/Postgres fast instance command that added a
// boolean NOT NULL DEFAULT false column `isInternalMessagesImportEnabled` to
// the `workspace` table IF NOT EXISTS.
//
// In MongoDB, workspace documents live in sabcrm_workspace. The field is
// schemaless but we seed the default `false` on existing documents via an
// updateMany so that application code can rely on the value being present.
//
// Original SQL:
//   ALTER TABLE "core"."workspace"
//     ADD COLUMN IF NOT EXISTS "isInternalMessagesImportEnabled" boolean NOT NULL DEFAULT false

export const VERSION = '2.5.0';
export const TIMESTAMP = 1778525104406;

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection('sabcrm_workspace');

  // Backfill default value for existing documents that lack the field
  await col.updateMany(
    { isInternalMessagesImportEnabled: { $exists: false } },
    { $set: { isInternalMessagesImportEnabled: false } },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection('sabcrm_workspace');

  await col.updateMany(
    {},
    { $unset: { isInternalMessagesImportEnabled: '' } },
  );
}
