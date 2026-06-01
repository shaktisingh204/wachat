// PORT-NOTE: pg-migration->mongo-index/seed
// Original:
//   1. DELETE FROM "core"."commandMenuItem" WHERE "engineComponentKey" IN
//      ('SAVE_RECORD_PAGE_LAYOUT', 'CANCEL_RECORD_PAGE_LAYOUT')
//   2. Recreate the Postgres ENUM without those two values.
//
// Mongo equivalent:
//   1. Delete documents with the obsolete engineComponentKey values.
//   2. No ENUM DDL exists in Mongo — the valid values are enforced at the app layer.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/** Removes command-menu-item documents that used the removed engine component keys. */
export async function applyMigration1773668124779(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_commandMenuItem");

  await col.deleteMany({
    engineComponentKey: {
      $in: ["SAVE_RECORD_PAGE_LAYOUT", "CANCEL_RECORD_PAGE_LAYOUT"],
    },
  });
}

/**
 * Reversal: no-op.
 * Deleted documents cannot be restored without a backup; the Postgres migration
 * also only drops the ENUM values and does not restore deleted rows.
 */
export async function rollbackMigration1773668124779(): Promise<void> {
  // No action — deleted documents are gone.
}
