// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration:
//   ALTER TABLE "core"."view" ADD "shouldHideEmptyGroups" boolean NOT NULL DEFAULT false
//
// Mongo analogue:
//   Backfill existing sabcrm_view documents with shouldHideEmptyGroups = false
//   so that application code can rely on the field being present.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const migration1765153412696 = {
  name: "AddViewShouldHideEmptyGroups1765153412696",
  description:
    "Backfills shouldHideEmptyGroups = false on existing sabcrm_view documents.",

  up: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db
      .collection("sabcrm_view")
      .updateMany(
        { shouldHideEmptyGroups: { $exists: false } },
        { $set: { shouldHideEmptyGroups: false } }
      );
  },

  down: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db
      .collection("sabcrm_view")
      .updateMany({}, { $unset: { shouldHideEmptyGroups: "" } });
  },
};
