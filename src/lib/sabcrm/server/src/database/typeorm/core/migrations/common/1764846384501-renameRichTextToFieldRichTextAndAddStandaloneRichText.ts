// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration renames the "RICH_TEXT" enum value to "FIELD_RICH_TEXT"
// and adds "STANDALONE_RICH_TEXT" to the pageLayoutWidget_type_enum in Postgres.
//
// New enum values after migration:
//   'VIEW' | 'IFRAME' | 'FIELDS' | 'GRAPH' | 'STANDALONE_RICH_TEXT' | 'TIMELINE'
//   | 'TASKS' | 'NOTES' | 'FILES' | 'EMAILS' | 'CALENDAR' | 'FIELD_RICH_TEXT'
//   | 'WORKFLOW' | 'WORKFLOW_VERSION' | 'WORKFLOW_RUN'
//
// Mongo analogue:
//   There is no DB-level enum. The `type` field on sabcrm_pageLayoutWidget
//   documents is a plain string. A one-time data migration is required to
//   rename existing documents that have type === 'RICH_TEXT' to 'FIELD_RICH_TEXT'.
//
// New valid widget type values (for application-level validation):
export const PAGE_LAYOUT_WIDGET_TYPES_AFTER_1764846384501 = [
  "VIEW",
  "IFRAME",
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

export type PageLayoutWidgetType1764846384501 =
  (typeof PAGE_LAYOUT_WIDGET_TYPES_AFTER_1764846384501)[number];

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const migration1764846384501 = {
  name: "RenameRichTextToFieldRichTextAndAddStandaloneRichText1764846384501",
  description:
    "Renames type='RICH_TEXT' to 'FIELD_RICH_TEXT' on all sabcrm_pageLayoutWidget documents. " +
    "'STANDALONE_RICH_TEXT' is a new valid value — no existing documents use it yet.",

  up: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db
      .collection("sabcrm_pageLayoutWidget")
      .updateMany({ type: "RICH_TEXT" }, { $set: { type: "FIELD_RICH_TEXT" } });
  },

  down: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    // Remove STANDALONE_RICH_TEXT docs if any exist, then rename back.
    await db
      .collection("sabcrm_pageLayoutWidget")
      .updateMany(
        { type: "STANDALONE_RICH_TEXT" },
        { $set: { type: "FIELD_RICH_TEXT" } }
      );
    await db
      .collection("sabcrm_pageLayoutWidget")
      .updateMany(
        { type: "FIELD_RICH_TEXT" },
        { $set: { type: "RICH_TEXT" } }
      );
  },
};
