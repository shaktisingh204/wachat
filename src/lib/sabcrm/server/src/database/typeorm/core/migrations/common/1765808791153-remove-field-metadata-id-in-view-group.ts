// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration:
//   ALTER TABLE "core"."viewGroup" DROP CONSTRAINT "FK_b3aa7ec58cdd9e83729f2232591"
//   ALTER TABLE "core"."viewGroup" DROP COLUMN "fieldMetadataId"
//
// Mongo analogue:
//   Unset fieldMetadataId from all sabcrm_viewGroup documents.
//   Drop any sparse index on fieldMetadataId if one exists.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const migration1765808791153 = {
  name: "RemoveFieldMetadataIdInViewGroup1765808791153",
  description:
    "Removes the fieldMetadataId field from all sabcrm_viewGroup documents.",

  up: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db
      .collection("sabcrm_viewGroup")
      .updateMany({}, { $unset: { fieldMetadataId: "" } });
    // Drop index if it was created in a prior migration.
    await db
      .collection("sabcrm_viewGroup")
      .dropIndex("IDX_viewGroup_fieldMetadataId")
      .catch(() => {
        /* index may not exist */
      });
  },

  down: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    // Re-add fieldMetadataId as null on all viewGroup docs.
    await db
      .collection("sabcrm_viewGroup")
      .updateMany(
        { fieldMetadataId: { $exists: false } },
        { $set: { fieldMetadataId: null } }
      );
    // Recreate sparse index if desired.
    await db
      .collection("sabcrm_viewGroup")
      .createIndex(
        { fieldMetadataId: 1 },
        { sparse: true, name: "IDX_viewGroup_fieldMetadataId" }
      );
  },
};
