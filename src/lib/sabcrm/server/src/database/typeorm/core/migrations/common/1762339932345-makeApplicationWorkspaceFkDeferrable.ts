// PORT-NOTE: pg-migration->mongo-index/seed
// Original: MakeApplicationWorkspaceFkDeferrable1762339932345
//
// This Postgres migration recreates the application.workspaceId foreign-key
// constraint as DEFERRABLE INITIALLY DEFERRED. The motivation is that an
// application document can be inserted before the corresponding workspace
// exists (the FK check is deferred to transaction commit).
//
// Mongo equivalent: MongoDB has no declarative foreign keys. The ordering
// constraint (application created before workspace) must be handled at the
// application layer. No index or seed change is required.
//
// Application-layer note: When inserting a new application document into
// sabcrm_application, it is acceptable for the referenced workspaceId to not
// yet exist in sabcrm_workspace — insert the workspace in the same logical
// operation immediately after.

export const migrationId = '1762339932345-makeApplicationWorkspaceFkDeferrable';
