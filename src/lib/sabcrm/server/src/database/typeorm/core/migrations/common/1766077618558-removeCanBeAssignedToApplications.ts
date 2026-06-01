// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration:
//   ALTER TABLE "core"."role" DROP COLUMN "canBeAssignedToApplications"
//
// Mongo analogue:
//   Unset canBeAssignedToApplications from all sabcrm_role documents.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const migration1766077618558 = {
  name: "RemoveCanBeAssignedToApplications1766077618558",
  description:
    "Removes the canBeAssignedToApplications field from all sabcrm_role documents.",

  up: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db
      .collection("sabcrm_role")
      .updateMany({}, { $unset: { canBeAssignedToApplications: "" } });
  },

  down: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db
      .collection("sabcrm_role")
      .updateMany(
        { canBeAssignedToApplications: { $exists: false } },
        { $set: { canBeAssignedToApplications: true } }
      );
  },
};
