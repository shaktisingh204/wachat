// PORT-NOTE: pg-migration->mongo-index/seed
// Original: RenameRoleTargets1764671363647
//
// This Postgres migration renames the "roleTargets" table to "roleTarget" and
// updates all associated constraints and indexes accordingly.
//
// Mongo equivalent: rename the collection from sabcrm_roletargets to
// sabcrm_roletarget and recreate indexes under the new names.

import "server-only";
import { connectToDatabase } from '@/lib/mongodb';

export const migrationId = '1764671363647-renameRoleTargets';

/** Apply the Mongo-equivalent of this migration (idempotent). */
export async function applyMongoMigration(): Promise<void> {
  const { db } = await connectToDatabase();

  // Only rename if the old collection still exists and the new one does not
  const oldCols = await db.listCollections({ name: 'sabcrm_roletargets' }).toArray();
  const newCols = await db.listCollections({ name: 'sabcrm_roletarget' }).toArray();

  if (oldCols.length > 0 && newCols.length === 0) {
    await db.collection('sabcrm_roletargets').rename('sabcrm_roletarget');
  }

  const col = db.collection('sabcrm_roletarget');

  // Recreate indexes with updated names
  await col.createIndex(
    { workspaceId: 1 },
    { name: 'IDX_ROLE_TARGET_WORKSPACE_ID' },
  );
  await col.createIndex(
    { agentId: 1 },
    { sparse: true, name: 'IDX_ROLE_TARGET_AGENT_ID' },
  );
  await col.createIndex(
    { apiKeyId: 1 },
    { sparse: true, name: 'IDX_ROLE_TARGET_API_KEY_ID' },
  );
  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, sparse: true, name: 'IDX_0082568653b80c15903c5a2ba9' },
  );

  // Sparse indexes for FK-like references
  await col.createIndex(
    { applicationId: 1 },
    { sparse: true, name: 'IDX_ROLE_TARGET_APPLICATION_ID' },
  );
  await col.createIndex(
    { roleId: 1 },
    { name: 'IDX_ROLE_TARGET_ROLE_ID' },
  );
}
