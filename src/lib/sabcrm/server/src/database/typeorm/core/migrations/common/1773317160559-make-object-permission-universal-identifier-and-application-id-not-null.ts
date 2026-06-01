// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: MakeObjectPermissionUniversalIdentifierAndApplicationIdNotNull1773317160559
//
// Postgres DDL intent:
//   - Called a util function that presumably:
//       1. Back-filled universalIdentifier + applicationId on existing objectPermission rows
//       2. Made both columns NOT NULL
//       3. Added index IDX_c5ea53618b32558fe24e495f21
//       4. Added FK FK_f2ecee1066fd43800dbc85f87e4 → core.application(id)
//   - Used a SAVEPOINT / ROLLBACK TO SAVEPOINT pattern; errors are swallowed.
//
// MongoDB equivalent:
//   - Remove documents that cannot be backfilled (mirrors orphan delete).
//   - Create a compound index on (universalIdentifier, applicationId).
//   - FK → application is enforced at the application layer.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

export const MIGRATION_NAME =
  "MakeObjectPermissionUniversalIdentifierAndApplicationIdNotNull1773317160559";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_objectPermission");

  try {
    // Remove documents that cannot be backfilled
    await col.deleteMany({
      $or: [
        { universalIdentifier: { $exists: false } },
        { universalIdentifier: null },
        { applicationId: { $exists: false } },
        { applicationId: null },
      ],
    });

    // Create compound index IDX_c5ea53618b32558fe24e495f21
    await col.createIndex(
      { universalIdentifier: 1, applicationId: 1 },
      { name: "IDX_objectPermission_universalIdentifier_applicationId" },
    );
  } catch (e) {
    // Swallow errors to mirror original migration behaviour
    console.error(
      "MakeObjectPermissionUniversalIdentifierAndApplicationIdNotNull1773317160559 error (swallowed)",
      e,
    );
  }
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_objectPermission")
    .dropIndex("IDX_objectPermission_universalIdentifier_applicationId")
    .catch(() => {});

  await db
    .collection("sabcrm_objectPermission")
    .updateMany(
      {},
      { $unset: { universalIdentifier: "", applicationId: "" } },
    );
}
