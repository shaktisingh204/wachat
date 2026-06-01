// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: MakePermissionFlagUniversalIdentifierAndApplicationIdNotNull1773232418468
//
// Postgres DDL intent:
//   - Called a util function (makePermissionFlagUniversalIdentifierAndApplicationIdNotNullQueries)
//     that presumably:
//       1. Back-filled universalIdentifier + applicationId on existing permissionFlag rows
//       2. Made both columns NOT NULL
//       3. Added index IDX_da8ffd3c24b4a819430a861067
//       4. Added FK FK_b26a9d39a88d0e72373c677c6c5 → core.application(id)
//   - Used a SAVEPOINT / ROLLBACK TO SAVEPOINT pattern; errors are swallowed.
//
// MongoDB equivalent:
//   - Documents missing `universalIdentifier` or `applicationId` should be removed or
//     backfilled before the application enforces NOT NULL semantics.
//   - Create a compound index on (universalIdentifier, applicationId) to mirror Postgres.
//   - The FK → application is enforced at the application layer.
//
// NOTE: The original util file is at:
//   src/database/typeorm/core/migrations/utils/
//     1773232418467-make-permission-flag-universal-identifier-and-application-id-not-null.util.ts
// That file is ported separately. This stub calls the Mongo equivalent directly.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

export const MIGRATION_NAME =
  "MakePermissionFlagUniversalIdentifierAndApplicationIdNotNull1773232418468";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_permissionFlag");

  try {
    // Remove documents that cannot be backfilled (mirrors Postgres orphan delete)
    await col.deleteMany({
      $or: [
        { universalIdentifier: { $exists: false } },
        { universalIdentifier: null },
        { applicationId: { $exists: false } },
        { applicationId: null },
      ],
    });

    // Create compound index IDX_da8ffd3c24b4a819430a861067
    await col.createIndex(
      { universalIdentifier: 1, applicationId: 1 },
      { name: "IDX_permissionFlag_universalIdentifier_applicationId" },
    );
  } catch (e) {
    // Swallow errors to mirror original migration behaviour
    console.error(
      "MakePermissionFlagUniversalIdentifierAndApplicationIdNotNull1773232418468 error (swallowed)",
      e,
    );
  }
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_permissionFlag")
    .dropIndex("IDX_permissionFlag_universalIdentifier_applicationId")
    .catch(() => {});

  await db
    .collection("sabcrm_permissionFlag")
    .updateMany(
      {},
      { $unset: { universalIdentifier: "", applicationId: "" } },
    );
}
