// PORT-NOTE: Postgres DDL migration — adds 'FIELDS_WIDGET' to the Postgres
// ENUM type "core"."view_type_enum".
// In MongoDB view types are stored as plain strings (not Postgres enums), so no
// structural migration is required. The TypeScript union type for ViewType
// simply needs to include the new value.
//
// Original Twenty migration: AddFieldsWidgetViewType1770906704231
//   UP:   ALTER TYPE "core"."view_type_enum"
//           ADD VALUE IF NOT EXISTS 'FIELDS_WIDGET' AFTER 'CALENDAR'
//   DOWN: recreates the old enum without 'FIELDS_WIDGET' and migrates the column
//
// No Mongo index or seed action required.
//
// Ensure the ViewType union type in the SabCRM shared types file includes:
//   | 'FIELDS_WIDGET'
//
// Existing VIEW_TYPE values: 'TABLE' | 'KANBAN' | 'CALENDAR' | 'FIELDS_WIDGET'

export type ViewType = 'TABLE' | 'KANBAN' | 'CALENDAR' | 'FIELDS_WIDGET';

export const migrationNote = {
  id: '1770906704231',
  name: 'AddFieldsWidgetViewType',
  mongoAction: 'enum-extension (type-only change)',
  note: 'MongoDB stores view type as a plain string; add FIELDS_WIDGET to the ViewType union in shared types.',
  newEnumValue: 'FIELDS_WIDGET',
  allValues: ['TABLE', 'KANBAN', 'CALENDAR', 'FIELDS_WIDGET'] as ViewType[],
} as const;
