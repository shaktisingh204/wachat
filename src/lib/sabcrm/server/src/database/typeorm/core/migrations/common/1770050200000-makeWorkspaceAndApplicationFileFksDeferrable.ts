// PORT-NOTE: Postgres DDL migration — makes several FK constraints DEFERRABLE
// INITIALLY DEFERRED on workspace and application tables.
// MongoDB has no FK constraints; referential integrity is enforced at the
// application layer. This migration has no Mongo structural equivalent.
//
// Original Twenty migration: MakeWorkspaceAndApplicationFileFksDeferrable1770050200000
//   UP:
//     Drops and re-adds FK_3b1acb13... on workspace.workspaceCustomApplicationId
//       as DEFERRABLE INITIALLY DEFERRED
//     Drops and re-adds FK_3818380... on application.packageJsonFileId
//       as DEFERRABLE INITIALLY DEFERRED
//     Drops and re-adds FK_28f2071... on application.yarnLockFileId
//       as DEFERRABLE INITIALLY DEFERRED
//   DOWN: removes DEFERRABLE attribute from the same FKs
//
// No Mongo index or seed action required.
// Document references (workspaceCustomApplicationId, packageJsonFileId,
// yarnLockFileId) are plain string/ObjectId fields — no deferred enforcement
// is possible or needed.

export const migrationNote = {
  id: '1770050200000',
  name: 'MakeWorkspaceAndApplicationFileFksDeferrable',
  mongoAction: 'noop',
  reason:
    'Deferrable FK constraints are Postgres-only; MongoDB enforces references at the application layer.',
  collections: ['sabcrm_workspace', 'sabcrm_application'],
} as const;
