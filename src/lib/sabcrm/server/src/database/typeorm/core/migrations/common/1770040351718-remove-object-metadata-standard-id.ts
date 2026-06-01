// PORT-NOTE: Postgres DDL migration — drops the "standardId" column from
// "core"."objectMetadata".
// In MongoDB this means the `standardId` field should no longer appear on
// sabcrm_objectmetadata documents. No structural migration needed (schemaless).
//
// Original Twenty migration: RemoveObjectMetadataStandardId1770040351718
//   UP:   ALTER TABLE "core"."objectMetadata" DROP COLUMN "standardId"
//   DOWN: ALTER TABLE "core"."objectMetadata" ADD "standardId" uuid
//
// Mongo data cleanup (optional, run once):
//   db.sabcrm_objectmetadata.updateMany({}, { $unset: { standardId: "" } })
//
// The TypeScript document type for ObjectMetadata should omit `standardId`
// after this migration point.

export const migrationNote = {
  id: '1770040351718',
  name: 'RemoveObjectMetadataStandardId',
  mongoAction: 'field-removal',
  collections: ['sabcrm_objectmetadata'],
  fieldsRemoved: ['standardId'],
  dataCleanup:
    'db.sabcrm_objectmetadata.updateMany({}, { $unset: { standardId: "" } })',
} as const;
