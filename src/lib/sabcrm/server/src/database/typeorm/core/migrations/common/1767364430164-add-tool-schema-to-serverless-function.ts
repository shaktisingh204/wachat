// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration:
//   ALTER TABLE "core"."serverlessFunction" ADD "toolInputSchema" jsonb
//   ALTER TABLE "core"."serverlessFunction" ADD "isTool" boolean NOT NULL DEFAULT false
//
// Mongo analogue:
//   - toolInputSchema: optional field (jsonb → object), no backfill needed (nullable).
//   - isTool: boolean with default false — backfill existing documents.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const migration1767364430164 = {
  name: "AddToolSchemaToServerlessFunction1767364430164",
  description:
    "Backfills isTool = false on existing sabcrm_serverlessFunction documents. " +
    "toolInputSchema is optional and requires no backfill.",

  up: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db
      .collection("sabcrm_serverlessFunction")
      .updateMany(
        { isTool: { $exists: false } },
        { $set: { isTool: false } }
      );
    // toolInputSchema is nullable — no backfill needed.
  },

  down: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db
      .collection("sabcrm_serverlessFunction")
      .updateMany({}, { $unset: { isTool: "", toolInputSchema: "" } });
  },
};
