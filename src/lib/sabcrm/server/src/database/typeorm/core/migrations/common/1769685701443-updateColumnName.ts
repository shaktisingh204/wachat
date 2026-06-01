// PORT-NOTE: Postgres DDL migration — renames a column in "core"."application".
// In MongoDB the sabcrm_application collection stores fields as document
// properties. This migration corresponds to renaming the field
// `defaultLogicFunctionRoleId` → `defaultRoleId` in the document schema.
//
// Original Twenty migration: UpdateColumnName1769685701443
//   UP:   ALTER TABLE "core"."application"
//           RENAME COLUMN "defaultLogicFunctionRoleId" TO "defaultRoleId"
//   DOWN: ALTER TABLE "core"."application"
//           RENAME COLUMN "defaultRoleId" TO "defaultLogicFunctionRoleId"
//
// Mongo equivalent (run once as a data migration):
//   db.sabcrm_application.updateMany(
//     { defaultLogicFunctionRoleId: { $exists: true } },
//     [{ $set: { defaultRoleId: "$defaultLogicFunctionRoleId" } },
//      { $unset: "defaultLogicFunctionRoleId" }]
//   )
//
// The TypeScript document type for Application should use `defaultRoleId`
// (string | null) after this migration point.

export const migrationNote = {
  id: '1769685701443',
  name: 'UpdateColumnName',
  mongoAction: 'field-rename',
  collections: ['sabcrm_application'],
  fieldRenamed: { from: 'defaultLogicFunctionRoleId', to: 'defaultRoleId' },
  dataCleanup: `db.sabcrm_application.updateMany(
    { defaultLogicFunctionRoleId: { $exists: true } },
    [{ $set: { defaultRoleId: "$defaultLogicFunctionRoleId" } },
     { $unset: "defaultLogicFunctionRoleId" }]
  )`,
} as const;
