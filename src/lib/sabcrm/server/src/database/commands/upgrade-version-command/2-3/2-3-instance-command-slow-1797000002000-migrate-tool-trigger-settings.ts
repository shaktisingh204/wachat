import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: SlowInstanceCommand — migrates isTool=true logicFunction rows to
// the new toolTriggerSettings / workflowActionTriggerSettings shape, then drops
// isTool and toolInputSchema columns.
// Version: 2.3.0  Timestamp: 1797000002000

export interface MigrateToolTriggerSettingsMigration {
  version: "2.3.0";
  timestamp: 1797000002000;
  type: "slow";
  description: "Backfill toolTriggerSettings + workflowActionTriggerSettings from toolInputSchema on isTool=true logicFunctions, then drop isTool and toolInputSchema";
}

const DEFAULT_INPUT_SCHEMA = { type: "object", properties: {} };

/**
 * Data migration (Mongo equivalent of the Postgres UPDATE):
 *
 * For every logicFunction where isTool=true and both new trigger-settings fields
 * are missing, synthesise:
 *   toolTriggerSettings          = { inputSchema: <toolInputSchema or default> }
 *   workflowActionTriggerSettings = { inputSchema: [<toolInputSchema or default>] }
 */
export async function runDataMigration(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_logicFunction");

  const cursor = collection.find({
    isTool: true,
    toolTriggerSettings: { $exists: false },
    workflowActionTriggerSettings: { $exists: false },
  });

  for await (const doc of cursor) {
    const inputSchema =
      doc.toolInputSchema !== null && doc.toolInputSchema !== undefined
        ? doc.toolInputSchema
        : DEFAULT_INPUT_SCHEMA;

    await collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          toolTriggerSettings: { inputSchema },
          workflowActionTriggerSettings: { inputSchema: [inputSchema] },
        },
      },
    );
  }
}

/**
 * Schema migration — drop isTool and toolInputSchema from all documents.
 */
export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_logicFunction");

  await collection.updateMany(
    {},
    { $unset: { isTool: "", toolInputSchema: "" } },
  );
}

/**
 * Roll back — restore isTool and toolInputSchema with a best-effort backfill.
 */
export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_logicFunction");

  // Restore isTool=false default for all documents.
  await collection.updateMany(
    { isTool: { $exists: false } },
    { $set: { isTool: false, toolInputSchema: null } },
  );

  // Best-effort reverse backfill: pull inputSchema from toolTriggerSettings.
  const cursor = collection.find({ toolTriggerSettings: { $exists: true } });

  for await (const doc of cursor) {
    await collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          isTool: true,
          toolInputSchema: (doc.toolTriggerSettings as { inputSchema?: unknown })?.inputSchema ?? null,
        },
      },
    );
  }
}
