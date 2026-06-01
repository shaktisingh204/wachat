// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration:
//   ALTER TABLE "core"."roleTarget" DROP COLUMN "targetApplicationId"
//   ALTER TABLE "core"."application" ADD "defaultServerlessFunctionRoleId" uuid
//
// Mongo analogue:
//   - Unset targetApplicationId from all sabcrm_roleTarget documents.
//   - No backfill for defaultServerlessFunctionRoleId (nullable, set by app).

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const migration1765206100942 = {
  name: "UpdateRoleColumns1765206100942",
  description:
    "Removes targetApplicationId from sabcrm_roleTarget documents. " +
    "Adds optional defaultServerlessFunctionRoleId field to sabcrm_application (no backfill needed).",

  up: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db
      .collection("sabcrm_roleTarget")
      .updateMany({}, { $unset: { targetApplicationId: "" } });
    // defaultServerlessFunctionRoleId is nullable — written by application code.
  },

  down: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db
      .collection("sabcrm_application")
      .updateMany({}, { $unset: { defaultServerlessFunctionRoleId: "" } });
    // Re-adding targetApplicationId as null on all roleTarget docs.
    await db
      .collection("sabcrm_roleTarget")
      .updateMany(
        { targetApplicationId: { $exists: false } },
        { $set: { targetApplicationId: null } }
      );
  },
};
