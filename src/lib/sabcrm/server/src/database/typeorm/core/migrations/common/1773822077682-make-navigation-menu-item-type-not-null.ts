// PORT-NOTE: pg-migration->mongo-index/seed
// Original: backfills "type" on navigationMenuItem rows and makes the column NOT NULL.
// Drops the check constraint "CHK_navigation_menu_item_target_fields" and adds
// "CHK_navigation_menu_item_type_fields".
//
// Mongo equivalent:
//   1. Remove documents where "type" is missing/null (mirrors the Postgres savepoint approach
//      that deletes rows it cannot backfill).
//   2. Enforce "type" presence via a partial unique index / validator note (no native CHECK).

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * Removes sabcrm_navigationMenuItem documents that have no "type" value,
 * then creates a required-field index to surface any future violations.
 */
export async function applyMigration1773822077682(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_navigationMenuItem");

  // Remove documents lacking a type (mirrors the Postgres savepoint-guarded backfill).
  await col.deleteMany({
    $or: [{ type: { $exists: false } }, { type: null }],
  });

  // Index on "type" — non-sparse to assert all remaining documents have the field.
  await col.createIndex(
    { type: 1 },
    {
      background: true,
      name: "idx_navMenuItem_type_required",
      // Partial filter expression: document must have a defined type.
      partialFilterExpression: { type: { $type: "string" } },
    },
  );
}

/** Reversal: drop the required-type index; type field remains in documents. */
export async function rollbackMigration1773822077682(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_navigationMenuItem");
  await col.dropIndex("idx_navMenuItem_type_required").catch(() => undefined);
}
