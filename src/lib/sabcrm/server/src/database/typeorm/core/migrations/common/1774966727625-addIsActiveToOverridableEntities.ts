// PORT-NOTE: pg-migration->mongo-index/seed
// Original:
//   1. ADD "isActive" boolean NOT NULL DEFAULT true to viewFieldGroup, viewField,
//      pageLayoutTab, pageLayoutWidget.
//   2. UPDATE SET isActive = false WHERE deletedAt IS NOT NULL for each table.
//
// Mongo equivalent:
//   1. Set isActive=true on all documents that don't yet have the field.
//   2. Set isActive=false on documents where deletedAt is present and non-null.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

const COLLECTIONS = [
  "sabcrm_viewFieldGroup",
  "sabcrm_viewField",
  "sabcrm_pageLayoutTab",
  "sabcrm_pageLayoutWidget",
] as const;

export async function applyMigration1774966727625(): Promise<void> {
  const { db } = await connectToDatabase();

  for (const name of COLLECTIONS) {
    const col = db.collection(name);

    // Default all existing docs to isActive=true.
    await col.updateMany(
      { isActive: { $exists: false } },
      { $set: { isActive: true } },
    );

    // Mark soft-deleted docs as inactive.
    await col.updateMany(
      { deletedAt: { $exists: true, $ne: null } },
      { $set: { isActive: false } },
    );
  }
}

/** Reversal: unset isActive from all documents. */
export async function rollbackMigration1774966727625(): Promise<void> {
  const { db } = await connectToDatabase();
  for (const name of COLLECTIONS) {
    await db.collection(name).updateMany({}, { $unset: { isActive: "" } });
  }
}
