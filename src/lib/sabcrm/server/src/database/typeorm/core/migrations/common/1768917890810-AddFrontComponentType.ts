// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration AddFrontComponentType1768917890810
//
// What this migration did in Postgres (core schema):
//   UP:
//     - Added 'FRONT_COMPONENT' to the core."pageLayoutWidget_type_enum" enum.
//       Previous enum values: VIEW | IFRAME | FIELD | FIELDS | GRAPH | STANDALONE_RICH_TEXT |
//         TIMELINE | TASKS | NOTES | FILES | EMAILS | CALENDAR | FIELD_RICH_TEXT | WORKFLOW |
//         WORKFLOW_VERSION | WORKFLOW_RUN
//       New enum includes all the above plus: FRONT_COMPONENT
//     - This required: rename old enum, create new enum, migrate column type, drop old enum.
//   DOWN: Reverts to the enum without FRONT_COMPONENT.
//
// Mongo equivalent:
//   The pageLayoutWidget document type uses a TypeScript union type for the `type` field.
//   Add 'FRONT_COMPONENT' to the union in the sabcrm_pageLayoutWidget schema module.
//   No index or seed change is needed.

export const MIGRATION_NAME = 'AddFrontComponentType1768917890810';

export type PageLayoutWidgetType =
  | 'VIEW'
  | 'IFRAME'
  | 'FIELD'
  | 'FIELDS'
  | 'GRAPH'
  | 'STANDALONE_RICH_TEXT'
  | 'TIMELINE'
  | 'TASKS'
  | 'NOTES'
  | 'FILES'
  | 'EMAILS'
  | 'CALENDAR'
  | 'FIELD_RICH_TEXT'
  | 'WORKFLOW'
  | 'WORKFLOW_VERSION'
  | 'WORKFLOW_RUN'
  | 'FRONT_COMPONENT'; // added in this migration
