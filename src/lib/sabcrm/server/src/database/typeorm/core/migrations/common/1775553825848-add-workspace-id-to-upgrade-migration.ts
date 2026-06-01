// PORT-NOTE: pg-migration->mongo-index/seed
// Original:
//   1. DROP the simple UNIQUE(name, attempt) constraint.
//   2. ADD workspaceId uuid (nullable).
//   3. CREATE UNIQUE INDEX on (name, attempt, workspaceId) WHERE workspaceId IS NOT NULL.
//   4. CREATE UNIQUE INDEX on (name, attempt) WHERE workspaceId IS NULL.
//   5. ADD FK workspaceId -> workspace(id) ON DELETE CASCADE.
//
// Mongo equivalent:
//   1. Drop the old compound unique index.
//   2. Create two partial unique indexes mirroring the Postgres partial indexes.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export async function applyMigration1775553825848(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_upgradeMigration");

  // Drop the previous simple compound unique index (from migration 1775487231605).
  await col
    .dropIndex("UQ_upgrade_migration_name_attempt")
    .catch(() => undefined);

  // Partial unique index for workspace-scoped migrations (workspaceId is set).
  await col.createIndex(
    { name: 1, attempt: 1, workspaceId: 1 },
    {
      unique: true,
      background: true,
      name: "UQ_upgrade_migration_workspace",
      partialFilterExpression: { workspaceId: { $type: "string" } },
    },
  );

  // Partial unique index for instance-level migrations (workspaceId is null/absent).
  await col.createIndex(
    { name: 1, attempt: 1 },
    {
      unique: true,
      background: true,
      name: "UQ_upgrade_migration_instance",
      partialFilterExpression: { workspaceId: null },
    },
  );
}

/** Reversal: swap back to a single simple compound index. */
export async function rollbackMigration1775553825848(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_upgradeMigration");

  await col
    .dropIndex("UQ_upgrade_migration_workspace")
    .catch(() => undefined);
  await col
    .dropIndex("UQ_upgrade_migration_instance")
    .catch(() => undefined);

  await col.createIndex(
    { name: 1, attempt: 1 },
    {
      unique: true,
      background: true,
      name: "UQ_upgrade_migration_name_attempt",
    },
  );
}
