// PORT-NOTE: pg-migration->mongo-index/seed
// Original: adds CASCADE foreign keys from many core tables to "core"."workspace"(id).
// Tables covered: indexMetadata, roleTarget, role, fieldMetadata, objectMetadata,
//   cronTrigger, databaseEventTrigger, routeTrigger, serverlessFunction,
//   dataSource, objectPermission, permissionFlag, serverlessFunctionLayer,
//   workspaceMigration.
//
// Mongo equivalent: create workspaceId index on each corresponding collection.
// Referential integrity (CASCADE DELETE) is enforced at the application layer.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/** List of sabcrm collections that carry a workspaceId reference. */
const WORKSPACE_REFERENCED_COLLECTIONS = [
  "sabcrm_indexMetadata",
  "sabcrm_roleTarget",
  "sabcrm_role",
  "sabcrm_fieldMetadata",
  "sabcrm_objectMetadata",
  "sabcrm_cronTrigger",
  "sabcrm_databaseEventTrigger",
  "sabcrm_routeTrigger",
  "sabcrm_serverlessFunction",
  "sabcrm_dataSource",
  "sabcrm_objectPermission",
  "sabcrm_permissionFlag",
  "sabcrm_serverlessFunctionLayer",
  "sabcrm_workspaceMigration",
] as const;

/**
 * Creates a workspaceId index on every collection that references the workspace entity.
 * This mirrors the foreign key indexes that Postgres would build implicitly.
 */
export async function addWorkspaceForeignKeysIndexes(): Promise<void> {
  const { db } = await connectToDatabase();

  for (const collectionName of WORKSPACE_REFERENCED_COLLECTIONS) {
    const col = db.collection(collectionName);
    await col.createIndex(
      { workspaceId: 1 },
      {
        background: true,
        name: `idx_${collectionName.replace("sabcrm_", "")}_workspaceId`,
      },
    );
  }
}

/** Drops the workspaceId indexes added by addWorkspaceForeignKeysIndexes(). */
export async function dropWorkspaceForeignKeysIndexes(): Promise<void> {
  const { db } = await connectToDatabase();

  for (const collectionName of WORKSPACE_REFERENCED_COLLECTIONS) {
    const col = db.collection(collectionName);
    const indexName = `idx_${collectionName.replace("sabcrm_", "")}_workspaceId`;
    await col.dropIndex(indexName).catch(() => undefined);
  }
}
