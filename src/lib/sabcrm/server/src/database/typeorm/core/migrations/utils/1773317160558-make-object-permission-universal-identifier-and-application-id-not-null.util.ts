// PORT-NOTE: pg-migration->mongo-index/seed
// Original Twenty migration: make-object-permission-universal-identifier-and-application-id-not-null
// PostgreSQL DDL (ALTER TABLE core.objectPermission) has no direct Mongo analogue for NOT NULL
// constraints or FK constraints. In MongoDB, enforcement is done at the application layer.
//
// Original Postgres operations:
//   - ALTER objectPermission.universalIdentifier SET NOT NULL
//   - ALTER objectPermission.applicationId SET NOT NULL
//   - DROP INDEX IF EXISTS "IDX_c5ea53618b32558fe24e495f21"
//   - CREATE UNIQUE INDEX "IDX_c5ea53618b32558fe24e495f21" ON objectPermission (workspaceId, universalIdentifier)
//   - DROP FK IF EXISTS "FK_f2ecee1066fd43800dbc85f87e4"
//   - ADD FK objectPermission.applicationId -> application(id) ON DELETE CASCADE
//
// Mongo equivalent:
//   - Ensure { workspaceId: 1, universalIdentifier: 1 } unique index on sabcrm_objectpermission

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * Ensures the Mongo equivalent of the objectPermission uniqueness constraint:
 * a unique compound index on (workspaceId, universalIdentifier).
 */
export async function ensureObjectPermissionIndexes(): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection("sabcrm_objectpermission");

  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, sparse: false, name: "IDX_objectPermission_workspaceId_universalIdentifier" }
  );
}
