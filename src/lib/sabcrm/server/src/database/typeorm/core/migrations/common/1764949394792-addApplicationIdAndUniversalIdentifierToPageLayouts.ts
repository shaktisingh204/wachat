// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration adds to "core"."pageLayoutWidget":
//   - universalIdentifier uuid (nullable → later made NOT NULL)
//   - applicationId uuid (nullable, FK to application ON DELETE CASCADE)
//   + UNIQUE INDEX (workspaceId, universalIdentifier)
//   + FK constraint on applicationId
//
// And to "core"."pageLayoutTab":
//   - universalIdentifier uuid (nullable → later made NOT NULL)
//   - applicationId uuid (nullable, FK to application ON DELETE CASCADE)
//   + UNIQUE INDEX (workspaceId, universalIdentifier)
//   + FK constraint on applicationId
//
// Mongo analogue:
//   Fields are added by application code. Create compound unique sparse indexes
//   on (workspaceId, universalIdentifier) for both collections.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const migration1764949394792 = {
  name: "AddApplicationIdAndUniversalIdentifierToPageLayouts1764949394792",
  description:
    "Creates compound unique sparse indexes on (workspaceId, universalIdentifier) " +
    "for sabcrm_pageLayoutWidget and sabcrm_pageLayoutTab.",

  mongoIndexes: [
    {
      collection: "sabcrm_pageLayoutWidget",
      index: { workspaceId: 1, universalIdentifier: 1 },
      options: {
        unique: true,
        sparse: true,
        name: "IDX_pageLayoutWidget_workspaceId_universalIdentifier",
      },
    },
    {
      collection: "sabcrm_pageLayoutTab",
      index: { workspaceId: 1, universalIdentifier: 1 },
      options: {
        unique: true,
        sparse: true,
        name: "IDX_pageLayoutTab_workspaceId_universalIdentifier",
      },
    },
  ],

  up: async (): Promise<void> => {
    const { db } = await connectToDatabase();

    await db
      .collection("sabcrm_pageLayoutWidget")
      .createIndex(
        { workspaceId: 1, universalIdentifier: 1 },
        {
          unique: true,
          sparse: true,
          name: "IDX_pageLayoutWidget_workspaceId_universalIdentifier",
        }
      );

    await db
      .collection("sabcrm_pageLayoutTab")
      .createIndex(
        { workspaceId: 1, universalIdentifier: 1 },
        {
          unique: true,
          sparse: true,
          name: "IDX_pageLayoutTab_workspaceId_universalIdentifier",
        }
      );
  },

  down: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db
      .collection("sabcrm_pageLayoutWidget")
      .dropIndex("IDX_pageLayoutWidget_workspaceId_universalIdentifier");
    await db
      .collection("sabcrm_pageLayoutTab")
      .dropIndex("IDX_pageLayoutTab_workspaceId_universalIdentifier");
  },
};
