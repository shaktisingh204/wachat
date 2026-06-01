// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration adds to "core"."pageLayout":
//   - universalIdentifier uuid (nullable)
//   - applicationId uuid (nullable, FK to application ON DELETE CASCADE)
//   + UNIQUE INDEX (workspaceId, universalIdentifier)
//   + FK constraint on applicationId
//
// Mongo analogue:
//   Fields added by application code. Create compound unique sparse index on
//   (workspaceId, universalIdentifier) for sabcrm_pageLayout.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const migration1765200057592 = {
  name: "AddApplicationIdAndUniversalIdentifierToPageLayouts1765200057592",
  description:
    "Creates a compound unique sparse index on (workspaceId, universalIdentifier) " +
    "for the sabcrm_pageLayout collection.",

  mongoIndexes: [
    {
      collection: "sabcrm_pageLayout",
      index: { workspaceId: 1, universalIdentifier: 1 },
      options: {
        unique: true,
        sparse: true,
        name: "IDX_pageLayout_workspaceId_universalIdentifier",
      },
    },
  ],

  up: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db
      .collection("sabcrm_pageLayout")
      .createIndex(
        { workspaceId: 1, universalIdentifier: 1 },
        {
          unique: true,
          sparse: true,
          name: "IDX_pageLayout_workspaceId_universalIdentifier",
        }
      );
  },

  down: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db
      .collection("sabcrm_pageLayout")
      .dropIndex("IDX_pageLayout_workspaceId_universalIdentifier");
  },
};
