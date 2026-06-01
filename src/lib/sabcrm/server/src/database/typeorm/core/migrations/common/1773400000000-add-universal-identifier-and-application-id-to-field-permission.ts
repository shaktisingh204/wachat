// PORT-NOTE: pg-migration->mongo-index/seed
// Original: ALTER TABLE "core"."fieldPermission" ADD "universalIdentifier" uuid
//           ALTER TABLE "core"."fieldPermission" ADD "applicationId" uuid
// Mongo equivalent: ensure sabcrm_fieldPermission collection documents can carry these fields.
// No explicit index is required for adding nullable fields; documents simply accept the new keys.
// If you need to back-fill, run the seedFieldPermissionIdentifiers() function below.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/** PORT-NOTE: Adds universalIdentifier and applicationId fields to sabcrm_fieldPermission.
 *  In Mongo these are schema-less additions — no DDL needed.
 *  The function below creates a sparse index on universalIdentifier for query performance. */
export async function applyMigration1773400000000(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_fieldPermission");

  // Sparse index mirrors the Postgres UUID column — only indexes docs where the field exists.
  await col.createIndex(
    { universalIdentifier: 1 },
    { sparse: true, background: true, name: "idx_fp_universalIdentifier" },
  );
  await col.createIndex(
    { applicationId: 1 },
    { sparse: true, background: true, name: "idx_fp_applicationId" },
  );
}

/** Reversal: drop the sparse indexes (field data itself stays in documents). */
export async function rollbackMigration1773400000000(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_fieldPermission");
  await col.dropIndex("idx_fp_universalIdentifier").catch(() => undefined);
  await col.dropIndex("idx_fp_applicationId").catch(() => undefined);
}
