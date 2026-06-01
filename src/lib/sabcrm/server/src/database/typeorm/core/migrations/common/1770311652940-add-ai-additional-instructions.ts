// PORT-NOTE: Postgres DDL migration — adds a nullable "aiAdditionalInstructions"
// text column to "core"."workspace".
// In MongoDB (sabcrm_workspace) this is a new optional text field.
//
// Original Twenty migration: AddAiAdditionalInstructions1770311652940
//   UP:   ALTER TABLE "core"."workspace" ADD "aiAdditionalInstructions" text
//   DOWN: ALTER TABLE "core"."workspace" DROP COLUMN "aiAdditionalInstructions"
//
// No Mongo structural migration required.
// Existing workspace documents without the field are implicitly null (no
// additional instructions).
//
// The TypeScript document type for Workspace should include:
//   aiAdditionalInstructions?: string | null

export const migrationNote = {
  id: '1770311652940',
  name: 'AddAiAdditionalInstructions',
  mongoAction: 'field-add',
  collections: ['sabcrm_workspace'],
  fieldsAdded: [
    { name: 'aiAdditionalInstructions', type: 'string | null', default: null },
  ],
} as const;
