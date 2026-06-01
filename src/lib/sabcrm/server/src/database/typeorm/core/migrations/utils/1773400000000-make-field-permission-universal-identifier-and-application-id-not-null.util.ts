// PORT-NOTE: pg-migration->mongo-index/seed
// Original Twenty migration: make-field-permission-universal-identifier-and-application-id-not-null
// PostgreSQL DDL (ALTER TABLE core.fieldPermission) has no direct Mongo analogue for NOT NULL
// constraints or FK constraints. In MongoDB, enforcement is done at the application layer.
//
// Original Postgres operations:
//   - ALTER fieldPermission.universalIdentifier SET NOT NULL
//   - ALTER fieldPermission.applicationId SET NOT NULL
//   - DROP INDEX IF EXISTS "IDX_0dedb90c717e179ef653c512b9"
//   - CREATE UNIQUE INDEX "IDX_0dedb90c717e179ef653c512b9" ON fieldPermission (workspaceId, universalIdentifier)
//   - DROP FK IF EXISTS "FK_71cc60c4a1c9f8a7c434d91d38c"
//   - ADD FK fieldPermission.applicationId -> application(id) ON DELETE CASCADE
//
// Mongo equivalent:
//   - Ensure { workspaceId: 1, universalIdentifier: 1 } unique index on sabcrm_fieldpermission

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * Ensures the Mongo equivalent of the fieldPermission uniqueness constraint:
 * a unique compound index on (workspaceId, universalIdentifier).
 */
export async function ensureFieldPermissionIndexes(): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection("sabcrm_fieldpermission");

  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, sparse: false, name: "IDX_fieldPermission_workspaceId_universalIdentifier" }
  );
}
