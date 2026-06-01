// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration:
//   ALTER TABLE "core"."dataSource"        ALTER COLUMN "workspaceId" TYPE uuid USING "workspaceId"::uuid
//   ALTER TABLE "core"."workspaceMigration" ALTER COLUMN "workspaceId" TYPE uuid USING "workspaceId"::uuid
//
// This cast converts a varchar/text column to a proper uuid column.
//
// Mongo analogue:
//   In MongoDB, workspaceId fields have been stored as strings (UUID v4 format).
//   There is no type enforcement at the DB level; values are already UUID strings.
//   No structural change is needed. However, if any documents stored a non-UUID
//   string in workspaceId, a data cleanup script would be required.
//
//   Since the original down() is intentionally not implemented (data-loss risk),
//   this stub also omits a meaningful down().

export const migration1767200000000 = {
  name: "FixDataSourceAndWorkspaceMigrationWorkspaceIdType1767200000000",
  description:
    "PORT-NOTE: Postgres-only type cast (varchar → uuid) on workspaceId in dataSource and " +
    "workspaceMigration. MongoDB stores workspaceId as a string UUID — no type change needed. " +
    "workspaceMigration table was subsequently dropped in migration 1767876112877.",
  up: async (): Promise<void> => {
    // No Mongo action required. workspaceId is already stored as a UUID string.
  },
  down: async (): Promise<void> => {
    // Rollback intentionally not implemented (mirrors original PG migration).
  },
} as const;
