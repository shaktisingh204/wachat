// PORT-NOTE: Postgres DDL migration — adds "eventLogRetentionDays" integer column
// (NOT NULL DEFAULT 90) to "core"."workspace".
// In MongoDB (sabcrm_workspace) this is a new document field. Documents created
// before this migration should default to 90 days when the field is absent; a
// backfill can be run if strict enforcement is needed.
//
// Original Twenty migration: AddWorkspaceEventLogRetention1770051000000
//   UP:   ALTER TABLE "core"."workspace"
//           ADD "eventLogRetentionDays" integer NOT NULL DEFAULT 90
//   DOWN: ALTER TABLE "core"."workspace"
//           DROP COLUMN "eventLogRetentionDays"
//
// Mongo backfill (optional, run once):
//   db.sabcrm_workspace.updateMany(
//     { eventLogRetentionDays: { $exists: false } },
//     { $set: { eventLogRetentionDays: 90 } }
//   )
//
// The TypeScript document type for Workspace should include:
//   eventLogRetentionDays: number  (default 90)

export const migrationNote = {
  id: '1770051000000',
  name: 'AddWorkspaceEventLogRetention',
  mongoAction: 'field-add',
  collections: ['sabcrm_workspace'],
  fieldsAdded: [
    { name: 'eventLogRetentionDays', type: 'number', default: 90 },
  ],
  backfill: `db.sabcrm_workspace.updateMany(
    { eventLogRetentionDays: { $exists: false } },
    { $set: { eventLogRetentionDays: 90 } }
  )`,
} as const;
