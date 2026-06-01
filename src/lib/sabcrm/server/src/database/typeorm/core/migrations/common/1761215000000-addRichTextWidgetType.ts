// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddRichTextWidgetType1761215000000
//
// This migration extends the Postgres "pageLayoutWidget_type_enum" to add the
// 'RICH_TEXT' variant. The full enum after this migration is:
//   'VIEW' | 'IFRAME' | 'FIELDS' | 'GRAPH' | 'TIMELINE' | 'TASKS' |
//   'NOTES' | 'FILES' | 'EMAILS' | 'CALENDAR' | 'RICH_TEXT'
//
// Mongo equivalent: The sabcrm_pagelayoutwidget collection stores "type" as a
// plain string. No schema change or index is needed — just ensure application
// code accepts 'RICH_TEXT' as a valid value.
//
// Accepted widget type values (union kept here for reference):
export type PageLayoutWidgetType =
  | 'VIEW'
  | 'IFRAME'
  | 'FIELDS'
  | 'GRAPH'
  | 'TIMELINE'
  | 'TASKS'
  | 'NOTES'
  | 'FILES'
  | 'EMAILS'
  | 'CALENDAR'
  | 'RICH_TEXT';

export const migrationId = '1761215000000-addRichTextWidgetType';
