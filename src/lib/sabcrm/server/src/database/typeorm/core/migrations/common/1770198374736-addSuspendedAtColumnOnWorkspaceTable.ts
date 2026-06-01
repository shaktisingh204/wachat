// PORT-NOTE: Postgres DDL migration — adds a nullable TIMESTAMP WITH TIME ZONE
// column "suspendedAt" to "core"."workspace".
// In MongoDB (sabcrm_workspace) this is a new optional Date field.
// No index is required unless suspension queries will be range-filtered.
//
// Original Twenty migration: AddSuspendedAtColumnOnWorkspaceTable1770198374736
//   UP:   ALTER TABLE "core"."workspace" ADD "suspendedAt" TIMESTAMP WITH TIME ZONE
//   DOWN: ALTER TABLE "core"."workspace" DROP COLUMN "suspendedAt"
//
// No Mongo structural migration required.
// Existing documents without the field will simply have `suspendedAt` undefined,
// which should be treated as null / not-suspended in application logic.
//
// The TypeScript document type for Workspace should include:
//   suspendedAt?: Date | null

export const migrationNote = {
  id: '1770198374736',
  name: 'AddSuspendedAtColumnOnWorkspaceTable',
  mongoAction: 'field-add',
  collections: ['sabcrm_workspace'],
  fieldsAdded: [
    { name: 'suspendedAt', type: 'Date | null', default: null },
  ],
} as const;
