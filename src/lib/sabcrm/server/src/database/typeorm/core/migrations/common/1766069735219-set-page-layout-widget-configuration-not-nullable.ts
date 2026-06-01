// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration:
//   ALTER TABLE "core"."pageLayoutWidget" ALTER COLUMN "configuration" SET NOT NULL
//
// Mongo analogue:
//   MongoDB does not enforce NOT NULL at the DB level by default.
//   To match the intent: seed all existing sabcrm_pageLayoutWidget documents that
//   have a null/missing `configuration` field with an empty object `{}`,
//   so application code can rely on the field being present.
//   Optionally add a JSON Schema validator to the collection if strict enforcement
//   is required, but that is not done here to preserve schema flexibility.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const migration1766069735219 = {
  name: "SetPageLayoutWidgetConfigurationNotNullable1766069735219",
  description:
    "Backfills configuration = {} on sabcrm_pageLayoutWidget documents where the field is absent or null.",

  up: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db
      .collection("sabcrm_pageLayoutWidget")
      .updateMany(
        {
          $or: [
            { configuration: { $exists: false } },
            { configuration: null },
          ],
        },
        { $set: { configuration: {} } }
      );
  },

  down: async (): Promise<void> => {
    // Setting configuration back to null would be destructive.
    // This is intentionally a no-op for down; the field remains present.
  },
};
