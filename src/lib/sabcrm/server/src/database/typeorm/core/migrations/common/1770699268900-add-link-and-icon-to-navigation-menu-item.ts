// PORT-NOTE: Postgres DDL migration — adds a nullable "link" text column to
// "core"."navigationMenuItem". (The class name refers to both link and icon, but
// the actual SQL only adds the "link" column. The "icon" column is added in a
// separate later migration 1771247783542.)
// In MongoDB (sabcrm_navigationmenuitem) this is a new optional text field.
//
// Original Twenty migration: AddLinkToNavigationMenuItem1770256542802
//   UP:   ALTER TABLE "core"."navigationMenuItem" ADD "link" text
//   DOWN: ALTER TABLE "core"."navigationMenuItem" DROP COLUMN "link"
//
// No Mongo structural migration required.
//
// The TypeScript document type for NavigationMenuItem should include:
//   link?: string | null

export const migrationNote = {
  id: '1770699268900',
  name: 'AddLinkAndIconToNavigationMenuItem',
  mongoAction: 'field-add',
  collections: ['sabcrm_navigationmenuitem'],
  fieldsAdded: [
    { name: 'link', type: 'string | null', default: null },
  ],
  note: 'Only the "link" field is added in this migration; "icon" is added in 1771247783542.',
} as const;
