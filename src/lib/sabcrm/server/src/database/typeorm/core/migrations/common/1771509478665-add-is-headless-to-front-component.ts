// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: AddIsHeadlessToFrontComponent1771509478665
//
// Postgres DDL intent:
//   - Added NOT NULL boolean column `isHeadless` with DEFAULT false to `core.frontComponent`
//
// MongoDB equivalent:
//   - The `sabcrm_frontComponent` collection document type should include:
//       isHeadless: boolean   // default: false
//   - Existing documents that pre-date this migration need the field seeded to `false`.
//
// Seed script:
//   db.getSiblingDB("sabcrm").sabcrm_frontComponent.updateMany(
//     { isHeadless: { $exists: false } },
//     { $set: { isHeadless: false } }
//   );

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

export const MIGRATION_NAME = "AddIsHeadlessToFrontComponent1771509478665";

/**
 * Seeds `isHeadless: false` on all existing `sabcrm_frontComponent` documents
 * that do not already have the field.
 */
export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_frontComponent")
    .updateMany({ isHeadless: { $exists: false } }, { $set: { isHeadless: false } });
}

/**
 * Rolls back by removing the `isHeadless` field from all documents.
 */
export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_frontComponent")
    .updateMany({}, { $unset: { isHeadless: "" } });
}
