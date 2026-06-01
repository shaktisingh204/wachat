// PORT-NOTE: Postgres DDL migration — adds "mimeType" character varying column
// (NOT NULL DEFAULT 'application/octet-stream') to "core"."file".
// In MongoDB (sabcrm_file) this is a new required string field with a default.
//
// Original Twenty migration: AddMimeTypeToFileTable1770814914548
//   UP:   ALTER TABLE "core"."file"
//           ADD "mimeType" character varying NOT NULL DEFAULT 'application/octet-stream'
//   DOWN: ALTER TABLE "core"."file" DROP COLUMN "mimeType"
//
// Mongo backfill (optional, run once):
//   db.sabcrm_file.updateMany(
//     { mimeType: { $exists: false } },
//     { $set: { mimeType: "application/octet-stream" } }
//   )
//
// The TypeScript document type for File should include:
//   mimeType: string  (default 'application/octet-stream')

export const migrationNote = {
  id: '1770814914548',
  name: 'AddMimeTypeToFileTable',
  mongoAction: 'field-add',
  collections: ['sabcrm_file'],
  fieldsAdded: [
    { name: 'mimeType', type: 'string', default: 'application/octet-stream' },
  ],
  backfill: `db.sabcrm_file.updateMany(
    { mimeType: { $exists: false } },
    { $set: { mimeType: "application/octet-stream" } }
  )`,
} as const;
