// PORT-NOTE: Postgres DDL migration — adds a nullable "icon" text column to
// "core"."navigationMenuItem".
// In MongoDB (sabcrm_navigationmenuitem) this is a new optional text field.
//
// Original Twenty migration: AddIconToNavigationMenuItem1771247783542
//   UP:   ALTER TABLE "core"."navigationMenuItem" ADD "icon" text
//   DOWN: ALTER TABLE "core"."navigationMenuItem" DROP COLUMN "icon"
//
// No Mongo structural migration required.
//
// The TypeScript document type for NavigationMenuItem should include:
//   icon?: string | null

export const migrationNote = {
  id: '1771247783542',
  name: 'AddIconToNavigationMenuItem',
  mongoAction: 'field-add',
  collections: ['sabcrm_navigationmenuitem'],
  fieldsAdded: [
    { name: 'icon', type: 'string | null', default: null },
  ],
} as const;
