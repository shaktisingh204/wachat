// PORT-NOTE: Postgres DDL migration — removes columns from "core"."logicFunction".
// In MongoDB the sabcrm_logicfunction collection stores all fields as document
// properties. This migration corresponds to removing the `latestVersion` and
// `publishedVersions` fields from the document schema.
//
// Original Twenty migration: RemoveLogicFunctionVersion1769681396664
//   UP:
//     ALTER TABLE "core"."logicFunction" DROP COLUMN "latestVersion"
//     ALTER TABLE "core"."logicFunction" DROP COLUMN "publishedVersions"
//   DOWN:
//     ALTER TABLE "core"."logicFunction" ADD "publishedVersions" jsonb NOT NULL DEFAULT '[]'
//     ALTER TABLE "core"."logicFunction" ADD "latestVersion" character varying
//
// Mongo equivalent:
//   No structural migration needed — MongoDB is schemaless.
//   If a data cleanup is desired, run:
//     db.sabcrm_logicfunction.updateMany({}, { $unset: { latestVersion: "", publishedVersions: "" } })
//
// The TypeScript type for LogicFunction documents should omit latestVersion and
// publishedVersions after this migration point.

export const migrationNote = {
  id: '1769681396664',
  name: 'RemoveLogicFunctionVersion',
  mongoAction: 'field-removal',
  collections: ['sabcrm_logicfunction'],
  fieldsRemoved: ['latestVersion', 'publishedVersions'],
  dataCleanup:
    'db.sabcrm_logicfunction.updateMany({}, { $unset: { latestVersion: "", publishedVersions: "" } })',
} as const;
