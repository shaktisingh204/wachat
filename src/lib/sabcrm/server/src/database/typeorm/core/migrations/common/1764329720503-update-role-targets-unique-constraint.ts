// PORT-NOTE: pg-migration->mongo-index/seed
// Original: UpdateRoleTargetsUniqueConstraint1764329720503
//
// This Postgres migration replaces the compound unique constraint
// IDX_ROLE_TARGETS_UNIQUE (workspaceId, userWorkspaceId, agentId, apiKeyId)
// with three per-field unique constraints:
//   - IDX_ROLE_TARGET_UNIQUE_API_KEY          (workspaceId, apiKeyId)
//   - IDX_ROLE_TARGET_UNIQUE_AGENT            (workspaceId, agentId)
//   - IDX_ROLE_TARGET_UNIQUE_USER_WORKSPACE   (workspaceId, userWorkspaceId)
//
// The migration uses a savepoint so constraint errors are swallowed.
//
// Mongo equivalent: Replace the old compound index with three sparse unique
// indexes on sabcrm_roletargets.

import "server-only";
import { connectToDatabase } from '@/lib/mongodb';

export const migrationId = '1764329720503-update-role-targets-unique-constraint';

/** Apply the Mongo-equivalent of this migration (idempotent). */
export async function applyMongoMigration(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection('sabcrm_roletargets');

  // Drop old compound unique index if it exists
  try {
    await col.dropIndex('IDX_ROLE_TARGETS_UNIQUE');
  } catch {
    // Index may not exist — swallow
  }

  // Per-entity unique indexes (sparse so null values don't conflict)
  await col.createIndex(
    { workspaceId: 1, apiKeyId: 1 },
    { unique: true, sparse: true, name: 'IDX_ROLE_TARGET_UNIQUE_API_KEY' },
  );
  await col.createIndex(
    { workspaceId: 1, agentId: 1 },
    { unique: true, sparse: true, name: 'IDX_ROLE_TARGET_UNIQUE_AGENT' },
  );
  await col.createIndex(
    { workspaceId: 1, userWorkspaceId: 1 },
    { unique: true, sparse: true, name: 'IDX_ROLE_TARGET_UNIQUE_USER_WORKSPACE' },
  );
}
