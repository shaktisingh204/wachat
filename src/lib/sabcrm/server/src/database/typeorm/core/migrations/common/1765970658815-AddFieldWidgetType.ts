// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration adds "FIELD" to the pageLayoutWidget_type_enum.
//
// New enum values after migration:
//   'VIEW' | 'IFRAME' | 'FIELD' | 'FIELDS' | 'GRAPH' | 'STANDALONE_RICH_TEXT'
//   | 'TIMELINE' | 'TASKS' | 'NOTES' | 'FILES' | 'EMAILS' | 'CALENDAR'
//   | 'FIELD_RICH_TEXT' | 'WORKFLOW' | 'WORKFLOW_VERSION' | 'WORKFLOW_RUN'
//
// Mongo analogue:
//   There is no DB-level enum; the type field is a plain string.
//   No data migration is needed — "FIELD" is a new value, no documents use it yet.
//   Update application-level validation to include 'FIELD'.

export const PAGE_LAYOUT_WIDGET_TYPES_AFTER_1765970658815 = [
  "VIEW",
  "IFRAME",
  "FIELD",
  "FIELDS",
  "GRAPH",
  "STANDALONE_RICH_TEXT",
  "TIMELINE",
  "TASKS",
  "NOTES",
  "FILES",
  "EMAILS",
  "CALENDAR",
  "FIELD_RICH_TEXT",
  "WORKFLOW",
  "WORKFLOW_VERSION",
  "WORKFLOW_RUN",
] as const;

export type PageLayoutWidgetType1765970658815 =
  (typeof PAGE_LAYOUT_WIDGET_TYPES_AFTER_1765970658815)[number];

export const migration1765970658815 = {
  name: "AddFieldWidgetType1765970658815",
  description:
    "No-op in Mongo: adds 'FIELD' as a valid string value for the type field on " +
    "sabcrm_pageLayoutWidget. No existing documents need to be migrated.",
  up: async (): Promise<void> => {
    // No data migration needed — 'FIELD' is a new value not used by existing documents.
  },
  down: async (): Promise<void> => {
    // No data migration needed.
  },
} as const;
