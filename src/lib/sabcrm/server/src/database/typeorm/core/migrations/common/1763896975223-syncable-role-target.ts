// PORT-NOTE: pg-migration->mongo-index/seed
// Original: SyncableRoleTarget1763896975223
//
// This Postgres migration:
//   1. Adds nullable uuid "universalIdentifier" to "roleTargets".
//   2. Adds nullable uuid "applicationId"        to "roleTargets".
//   3. Creates a unique index on (workspaceId, universalIdentifier).
//   4. Adds FK from applicationId → application.id ON DELETE CASCADE.
//
// Mongo equivalents: add indexes to sabcrm_roletargets.

import "server-only";
import { connectToDatabase } from '@/lib/mongodb';

export const migrationId = '1763896975223-syncable-role-target';

/** Apply the Mongo-equivalent of this migration (idempotent). */
export async function applyMongoMigration(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection('sabcrm_roletargets');

  // Unique index on (workspaceId, universalIdentifier) — sparse so nulls are excluded
  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    {
      unique: true,
      sparse: true,
      name: 'IDX_3e571e80f99488686015f3d00c',
    },
  );

  // Sparse index on applicationId to support FK-like lookups / cascade emulation
  await col.createIndex(
    { applicationId: 1 },
    { sparse: true, name: 'IDX_ROLE_TARGETS_APPLICATION_ID' },
  );
}
