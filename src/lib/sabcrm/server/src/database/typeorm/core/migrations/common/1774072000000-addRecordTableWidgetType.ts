// PORT-NOTE: pg-migration->mongo-index/seed
// Original: adds 'RECORD_TABLE' to the "pageLayoutWidget_type_enum" Postgres ENUM.
// Mongo equivalent: no DDL needed; the "type" field in sabcrm_pageLayoutWidget is
// a plain string. 'RECORD_TABLE' is now a valid value at the application layer.
// A note document is seeded into a meta-collection for audit purposes.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/** Valid pageLayoutWidget type values after this migration. */
export const PAGE_LAYOUT_WIDGET_TYPES = [
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
  "RECORD_TABLE", // added by this migration
] as const;

export type PageLayoutWidgetType = (typeof PAGE_LAYOUT_WIDGET_TYPES)[number];

/**
 * No schema change required in Mongo.
 * Emits a migration-boundary record in sabcrm_migrations_audit for traceability.
 */
export async function applyMigration1774072000000(): Promise<void> {
  const { db } = await connectToDatabase();
  const audit = db.collection("sabcrm_migrations_audit");
  await audit.updateOne(
    { migrationId: "1774072000000" },
    {
      $set: {
        migrationId: "1774072000000",
        name: "AddRecordTableWidgetType",
        appliedAt: new Date(),
        note: "RECORD_TABLE added to pageLayoutWidget.type valid values",
      },
    },
    { upsert: true },
  );
}

/** Reversal: remove the audit record. */
export async function rollbackMigration1774072000000(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_migrations_audit")
    .deleteOne({ migrationId: "1774072000000" });
}
