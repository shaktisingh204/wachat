// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: core."pageLayoutWidget_type_enum" — adds new enum values VIEW, IFRAME, TIMELINE, TASKS, NOTES, FILES, EMAILS, CALENDAR.
// Existing values: FIELDS, GRAPH, IFRAME, VIEW. New full set: VIEW, IFRAME, FIELDS, GRAPH, TIMELINE, TASKS, NOTES, FILES, EMAILS, CALENDAR.

/**
 * Migration 1760628085765 – AddNewWidgetTypes
 *
 * Postgres intent:
 *   UP:   Expand pageLayoutWidget_type_enum to include TIMELINE, TASKS, NOTES, FILES, EMAILS, CALENDAR;
 *         migrate existing column data using USING cast; set DEFAULT 'VIEW'.
 *   DOWN: Shrink enum back to original set (VIEW, IFRAME, FIELDS, GRAPH).
 *
 * Mongo equivalent:
 *   - sabcrm_pageLayoutWidget documents store `type` as a plain string.
 *   - The full allowed set is now: 'VIEW' | 'IFRAME' | 'FIELDS' | 'GRAPH' | 'TIMELINE' | 'TASKS' | 'NOTES' | 'FILES' | 'EMAILS' | 'CALENDAR'.
 *   - Default value: 'VIEW'.
 *   - Validation is enforced at the Zod schema / application layer.
 *   - No DDL index changes required.
 */

export type PageLayoutWidgetType =
  | "VIEW"
  | "IFRAME"
  | "FIELDS"
  | "GRAPH"
  | "TIMELINE"
  | "TASKS"
  | "NOTES"
  | "FILES"
  | "EMAILS"
  | "CALENDAR";

export const PAGE_LAYOUT_WIDGET_TYPE_DEFAULT: PageLayoutWidgetType = "VIEW";

export const PAGE_LAYOUT_WIDGET_TYPES: readonly PageLayoutWidgetType[] = [
  "VIEW",
  "IFRAME",
  "FIELDS",
  "GRAPH",
  "TIMELINE",
  "TASKS",
  "NOTES",
  "FILES",
  "EMAILS",
  "CALENDAR",
] as const;

export const migrationNote = {
  id: "1760628085765",
  name: "AddNewWidgetTypes",
  mongoEquivalent:
    "Expand PageLayoutWidgetType enum at the application layer; no DDL required",
} as const;
