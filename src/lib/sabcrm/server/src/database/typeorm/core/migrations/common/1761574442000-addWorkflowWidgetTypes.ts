// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddWorkflowWidgetTypes1761574442000
//
// This migration extends the Postgres "pageLayoutWidget_type_enum" to add:
//   'WORKFLOW' | 'WORKFLOW_VERSION' | 'WORKFLOW_RUN'
//
// Full enum after this migration:
//   'VIEW' | 'IFRAME' | 'FIELDS' | 'GRAPH' | 'TIMELINE' | 'TASKS' |
//   'NOTES' | 'FILES' | 'EMAILS' | 'CALENDAR' | 'RICH_TEXT' |
//   'WORKFLOW' | 'WORKFLOW_VERSION' | 'WORKFLOW_RUN'
//
// Mongo equivalent: The sabcrm_pagelayoutwidget collection stores "type" as a
// plain string. No schema change or index is needed — ensure application code
// accepts the three new workflow widget type values.

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
  | 'RICH_TEXT'
  | 'WORKFLOW'
  | 'WORKFLOW_VERSION'
  | 'WORKFLOW_RUN';

export const migrationId = '1761574442000-addWorkflowWidgetTypes';
