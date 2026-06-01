import "server-only";

// PORT-NOTE: Fast instance command — renames and recreates a Postgres ENUM type
// (pageLayoutWidget_type_enum) to add the EMAIL_THREAD variant.
// Enums are Postgres-specific DDL and have no direct Mongo equivalent.
// Exported as a documented stub. If SabNode validates widget types application-side,
// add EMAIL_THREAD to the relevant TypeScript union / zod schema instead.

/**
 * Fast instance command: 1.21.0 / 1775200000000
 * Add EMAIL_THREAD to pageLayoutWidget_type_enum
 *
 * Postgres up: rename old enum, create new enum with EMAIL_THREAD, migrate column, drop old.
 * Postgres down: recreate old enum without EMAIL_THREAD, migrate column back, drop new.
 *
 * Mongo note: widget type is stored as a plain string field — no DDL migration needed.
 * Add 'EMAIL_THREAD' to the application-level PageLayoutWidgetType union/zod schema.
 */
export const PAGE_LAYOUT_WIDGET_TYPES_WITH_EMAIL_THREAD = [
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
  "FRONT_COMPONENT",
  "RECORD_TABLE",
  "EMAIL_THREAD",
] as const;

export type PageLayoutWidgetType =
  (typeof PAGE_LAYOUT_WIDGET_TYPES_WITH_EMAIL_THREAD)[number];

export const ADD_EMAIL_THREAD_WIDGET_TYPE_META = {
  version: "1.21.0",
  timestamp: 1775200000000,
  name: "AddEmailThreadWidgetTypeFastInstanceCommand",
} as const;
