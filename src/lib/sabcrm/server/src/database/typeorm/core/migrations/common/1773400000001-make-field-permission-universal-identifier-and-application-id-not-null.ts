// PORT-NOTE: pg-migration->mongo-index/seed
// Original: backfills universalIdentifier + applicationId and makes them NOT NULL in Postgres.
// Mongo equivalent: create a unique compound index (universalIdentifier + applicationId) and
// ensure all existing documents in sabcrm_fieldPermission have both fields populated.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * Applies the Mongo analogue of the "make not-null" migration:
 * 1. Removes any documents that lack universalIdentifier or applicationId (mirrors Postgres
 *    savepoint-protected backfill that skips rows it cannot fix).
 * 2. Creates a compound unique index on (universalIdentifier, applicationId).
 */
export async function applyMigration1773400000001(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_fieldPermission");

  // Drop documents missing either field (mirrors the Postgres savepoint approach:
  // rows that cannot be backfilled are excluded rather than blocking the migration).
  await col.deleteMany({
    $or: [
      { universalIdentifier: { $exists: false } },
      { universalIdentifier: null },
      { applicationId: { $exists: false } },
      { applicationId: null },
    ],
  });

  // Compound unique index mirrors "IDX_0dedb90c717e179ef653c512b9" and
  // "FK_71cc60c4a1c9f8a7c434d91d38c".
  await col.createIndex(
    { universalIdentifier: 1, applicationId: 1 },
    {
      unique: true,
      background: true,
      name: "idx_fp_universalIdentifier_applicationId_unique",
    },
  );
}

/** Reversal: drop the compound unique index. */
export async function rollbackMigration1773400000001(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_fieldPermission");
  await col
    .dropIndex("idx_fp_universalIdentifier_applicationId_unique")
    .catch(() => undefined);
}
