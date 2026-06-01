// PORT-NOTE: Postgres DDL migration — drops the "standardId" uuid column from
// four core tables: agent, role, fieldMetadata, and skill.
// In MongoDB these map to four collections; the field can be removed by
// updating the document types and optionally running a data-cleanup pass.
//
// Original Twenty migration: DropStandardIdFromCoreEntities1770047816358
//   UP:
//     ALTER TABLE "core"."agent"         DROP COLUMN "standardId"
//     ALTER TABLE "core"."role"          DROP COLUMN "standardId"
//     ALTER TABLE "core"."fieldMetadata" DROP COLUMN "standardId"
//     ALTER TABLE "core"."skill"         DROP COLUMN "standardId"
//   DOWN:
//     ALTER TABLE "core"."skill"         ADD "standardId" uuid
//     ALTER TABLE "core"."fieldMetadata" ADD "standardId" uuid
//     ALTER TABLE "core"."role"          ADD "standardId" uuid
//     ALTER TABLE "core"."agent"         ADD "standardId" uuid
//
// Mongo data cleanup (optional, run once per collection):
//   db.sabcrm_agent.updateMany({},         { $unset: { standardId: "" } })
//   db.sabcrm_role.updateMany({},          { $unset: { standardId: "" } })
//   db.sabcrm_fieldmetadata.updateMany({}, { $unset: { standardId: "" } })
//   db.sabcrm_skill.updateMany({},         { $unset: { standardId: "" } })
//
// The TypeScript document types for Agent, Role, FieldMetadata, and Skill
// should omit `standardId` after this migration point.

export const migrationNote = {
  id: '1770047816358',
  name: 'DropStandardIdFromCoreEntities',
  mongoAction: 'field-removal',
  collections: [
    'sabcrm_agent',
    'sabcrm_role',
    'sabcrm_fieldmetadata',
    'sabcrm_skill',
  ],
  fieldsRemoved: ['standardId'],
  dataCleanup: [
    'db.sabcrm_agent.updateMany({},         { $unset: { standardId: "" } })',
    'db.sabcrm_role.updateMany({},          { $unset: { standardId: "" } })',
    'db.sabcrm_fieldmetadata.updateMany({}, { $unset: { standardId: "" } })',
    'db.sabcrm_skill.updateMany({},         { $unset: { standardId: "" } })',
  ],
} as const;
