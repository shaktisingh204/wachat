// PORT-NOTE: Postgres DDL migration — adds a nullable "position" jsonb column
// to "core"."pageLayoutWidget".
// In MongoDB the sabcrm_pagelayoutwidget collection is schemaless; the
// `position` field can simply be included on new documents without a
// structural migration.
//
// Original Twenty migration: AddPageLayoutWidgetPositionColumn1770046227329
//   UP:   ALTER TABLE "core"."pageLayoutWidget" ADD "position" jsonb
//   DOWN: ALTER TABLE "core"."pageLayoutWidget" DROP COLUMN "position"
//
// No Mongo index required — position is not used as a query filter.
//
// The TypeScript document type for PageLayoutWidget should include:
//   position?: Record<string, unknown> | null

export const migrationNote = {
  id: '1770046227329',
  name: 'AddPageLayoutWidgetPositionColumn',
  mongoAction: 'field-add',
  collections: ['sabcrm_pagelayoutwidget'],
  fieldsAdded: [
    { name: 'position', type: 'Record<string, unknown> | null', default: null },
  ],
} as const;
