import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: FastInstanceCommand — creates a compound index on upgradeMigration.
// Version: 2.3.0  Timestamp: 1777308014234

export interface AddUpgradeMigrationWorkspaceIdIndexMigration {
  version: "2.3.0";
  timestamp: 1777308014234;
  type: "fast";
  description: "Create compound index on upgradeMigration (workspaceId, name, attempt)";
}

/**
 * Mongo analogue:
 *
 * up:   CREATE INDEX IF NOT EXISTS "IDX_UPGRADE_MIGRATION_WORKSPACE_ID_NAME_ATTEMPT"
 *       ON "core"."upgradeMigration" ("workspaceId", "name", "attempt")
 *       WHERE "workspaceId" IS NOT NULL
 *
 * In MongoDB we create a compound index on the sabcrm_upgradeMigration collection
 * with a partial filter expression equivalent to WHERE workspaceId IS NOT NULL.
 */
export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_upgradeMigration");

  await collection.createIndex(
    { workspaceId: 1, name: 1, attempt: 1 },
    {
      name: "IDX_UPGRADE_MIGRATION_WORKSPACE_ID_NAME_ATTEMPT",
      partialFilterExpression: { workspaceId: { $exists: true, $ne: null } },
      background: true,
    },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_upgradeMigration");

  await collection.dropIndex("IDX_UPGRADE_MIGRATION_WORKSPACE_ID_NAME_ATTEMPT");
}
