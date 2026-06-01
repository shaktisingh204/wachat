// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration:
//   ALTER TABLE "core"."roleTarget" ADD "targetApplicationId" uuid
//   ALTER TABLE "core"."role" ADD "canBeAssignedToApplications" boolean NOT NULL DEFAULT true
//
// Mongo analogue:
//   - sabcrm_roleTarget gains an optional field `targetApplicationId` (string UUID ref).
//   - sabcrm_role gains a boolean field `canBeAssignedToApplications` defaulting to true.
//   A seed is required to backfill `canBeAssignedToApplications` on existing role docs.
//
// NOTE: This field was later removed in migration 1766077618558. If running migrations
// in order, this seed will be undone by that later migration's down() step.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const migration1764923552610 = {
  name: "AddApplicationRoleColumns1764923552610",
  description:
    "Adds targetApplicationId to sabcrm_roleTarget and canBeAssignedToApplications (default true) to sabcrm_role.",

  up: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    // Backfill canBeAssignedToApplications = true for existing role documents.
    await db
      .collection("sabcrm_role")
      .updateMany(
        { canBeAssignedToApplications: { $exists: false } },
        { $set: { canBeAssignedToApplications: true } }
      );
    // targetApplicationId on sabcrm_roleTarget is nullable — no backfill needed.
  },

  down: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db
      .collection("sabcrm_role")
      .updateMany({}, { $unset: { canBeAssignedToApplications: "" } });
    await db
      .collection("sabcrm_roleTarget")
      .updateMany({}, { $unset: { targetApplicationId: "" } });
  },
};
