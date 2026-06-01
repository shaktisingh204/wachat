// PORT-NOTE: Postgres DDL migration — adds a nullable "color" text column to
// "core"."navigationMenuItem".
// In MongoDB (sabcrm_navigationmenuitem) this is a new optional text field.
//
// Original Twenty migration: AddColorToNavigationMenuItem1771146443209
//   UP:   ALTER TABLE "core"."navigationMenuItem" ADD "color" text
//   DOWN: ALTER TABLE "core"."navigationMenuItem" DROP COLUMN "color"
//
// No Mongo structural migration required.
//
// The TypeScript document type for NavigationMenuItem should include:
//   color?: string | null

export const migrationNote = {
  id: '1771146443209',
  name: 'AddColorToNavigationMenuItem',
  mongoAction: 'field-add',
  collections: ['sabcrm_navigationmenuitem'],
  fieldsAdded: [
    { name: 'color', type: 'string | null', default: null },
  ],
} as const;
