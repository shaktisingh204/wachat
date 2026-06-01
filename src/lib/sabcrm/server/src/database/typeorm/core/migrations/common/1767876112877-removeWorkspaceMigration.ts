// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration:
//   DROP TABLE "core"."workspaceMigration"
//
// Mongo analogue:
//   Drop the sabcrm_workspaceMigration collection.
//   down() recreates it as an empty collection.
//   workspaceMigration fields: id, migrations (jsonb→array), name, isCustom,
//     appliedAt, workspaceId, createdAt.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const migration1767876112877 = {
  name: "RemoveWorkspaceMigration1767876112877",
  description:
    "Drops the sabcrm_workspaceMigration collection from Mongo.",

  up: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db
      .collection("sabcrm_workspaceMigration")
      .drop()
      .catch(() => {
        /* collection may not exist */
      });
  },

  down: async (): Promise<void> => {
    // Recreate the collection (empty — historical migration records are lost).
    const { db } = await connectToDatabase();
    await db
      .createCollection("sabcrm_workspaceMigration")
      .catch(() => {
        /* already exists */
      });
  },
};
