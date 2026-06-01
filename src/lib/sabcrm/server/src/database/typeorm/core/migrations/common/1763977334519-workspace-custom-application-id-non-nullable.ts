// PORT-NOTE: pg-migration->mongo-index/seed
// Original: WorkspaceCustomApplicationIdNonNullable1763977334519
//
// This Postgres migration makes workspace.workspaceCustomApplicationId NOT NULL
// (after ensuring all rows have a value). It uses a savepoint so a missing FK
// constraint doesn't abort the entire migration.
//
// Mongo equivalent: Enforce at the application layer that all
// sabcrm_workspace documents have a non-null workspaceCustomApplicationId.
// A one-off audit query is provided below.
//
// Audit: find workspaces missing the field:
//   db.sabcrm_workspace.find({
//     $or: [
//       { workspaceCustomApplicationId: { $exists: false } },
//       { workspaceCustomApplicationId: null }
//     ]
//   });
//
// No new Mongo index is needed (the sparse index from migration
// 1762437814771 covers this field).

export const migrationId = '1763977334519-workspace-custom-application-id-non-nullable';
