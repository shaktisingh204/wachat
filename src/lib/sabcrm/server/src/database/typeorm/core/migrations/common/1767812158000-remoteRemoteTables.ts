// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration:
//   DROP TABLE "core"."remoteTable"
//   DROP TABLE "core"."remoteServer"
//
// Mongo analogue:
//   Drop the sabcrm_remoteTable and sabcrm_remoteServer collections entirely.
//   The down() recreates them as empty collections (schema documented below).

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const migration1767812158000 = {
  name: "RemoteRemoteTables1767812158000",
  description:
    "Drops sabcrm_remoteTable and sabcrm_remoteServer collections from Mongo.",

  up: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db
      .collection("sabcrm_remoteTable")
      .drop()
      .catch(() => {
        /* collection may not exist */
      });
    await db
      .collection("sabcrm_remoteServer")
      .drop()
      .catch(() => {
        /* collection may not exist */
      });
  },

  down: async (): Promise<void> => {
    // Recreate empty collections.
    // sabcrm_remoteTable fields: id, distantTableName, localTableName, workspaceId, remoteServerId, createdAt, updatedAt
    // sabcrm_remoteServer fields: id, foreignDataWrapperId, foreignDataWrapperType, label,
    //   foreignDataWrapperOptions, userMappingOptions, schema, workspaceId, createdAt, updatedAt
    const { db } = await connectToDatabase();
    await db
      .createCollection("sabcrm_remoteTable")
      .catch(() => {
        /* already exists */
      });
    await db
      .createCollection("sabcrm_remoteServer")
      .catch(() => {
        /* already exists */
      });
  },
};
