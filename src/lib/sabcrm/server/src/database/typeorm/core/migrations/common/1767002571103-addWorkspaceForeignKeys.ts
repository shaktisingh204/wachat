// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration: AddWorkspaceForeignKeys1767002571103
//
// In Postgres this migration adds FOREIGN KEY constraints from many tables
// (remoteServer, remoteTable, workspaceMigration, serverlessFunctionLayer,
//  permissionFlag, objectPermission, dataSource, serverlessFunction,
//  routeTrigger, databaseEventTrigger, cronTrigger, objectMetadata,
//  fieldMetadata, role, roleTarget, indexMetadata) back to "core"."workspace"("id").
//
// Mongo analogue:
//   MongoDB does not enforce foreign key constraints at the database level.
//   These FK constraints codify that every document referencing a workspace
//   must have a valid workspaceId. In SabNode this is enforced at the
//   application layer (see sabcrm service/action code that validates workspaceId
//   before writing).
//
//   The appropriate Mongo analogue is to ensure indexes exist on the
//   `workspaceId` field for each affected collection so that workspace-scoped
//   queries are efficient. Those indexes are typically created in the schema
//   modules for each entity (entity->mongo-schema kind). No additional index
//   or seed action is created here to avoid duplication.
//
//   Original up() was wrapped in a savepoint and silently swallowed errors,
//   indicating these FKs are best-effort. That is consistent with Mongo's
//   lack of FK enforcement.

export const migration1767002571103 = {
  name: "AddWorkspaceForeignKeys1767002571103",
  description:
    "PORT-NOTE: Pure Postgres FK-constraint migration with no direct Mongo analogue. " +
    "workspaceId referential integrity is enforced at the application layer in SabNode. " +
    "Ensure each collection has a workspaceId index (defined in entity schema modules).",
  up: async (): Promise<void> => {
    // No Mongo action required. workspaceId indexes are created in entity schema modules.
  },
  down: async (): Promise<void> => {
    // No Mongo action required.
  },
} as const;
