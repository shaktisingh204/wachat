// PORT-NOTE: pg-migration->mongo-index/seed
// Original:
//   ALTER TABLE "core"."workspace" DROP COLUMN IF EXISTS "autoEnableNewAiModels"
//   ALTER TABLE "core"."workspace" DROP COLUMN IF EXISTS "disabledAiModelIds"
//
// Mongo equivalent: unset those fields from all sabcrm_workspace documents so they
// no longer appear in new reads.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/** Removes legacy AI-model columns from all workspace documents. */
export async function applyMigration1774100000000(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_workspace");

  await col.updateMany(
    {},
    { $unset: { autoEnableNewAiModels: "", disabledAiModelIds: "" } },
  );
}

/** Reversal: re-adds the columns with their original defaults. */
export async function rollbackMigration1774100000000(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_workspace");

  // Restore docs that don't already have the fields.
  await col.updateMany(
    { disabledAiModelIds: { $exists: false } },
    { $set: { disabledAiModelIds: [], autoEnableNewAiModels: true } },
  );
}
