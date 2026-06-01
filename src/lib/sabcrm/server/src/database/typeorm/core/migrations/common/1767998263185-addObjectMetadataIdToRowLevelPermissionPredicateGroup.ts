// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration:
//   DROP INDEX "core"."IDX_RLPPG_WORKSPACE_ID_ROLE_ID"
//   ALTER TABLE "core"."rowLevelPermissionPredicateGroup" ADD "objectMetadataId" uuid NOT NULL
//   CREATE INDEX "IDX_RLPPG_WORKSPACE_ID_ROLE_ID_OBJECT_METADATA_ID" ON (...) (workspaceId, roleId, objectMetadataId)
//   ADD FK on objectMetadataId referencing objectMetadata(id) ON DELETE CASCADE
//
// Mongo analogue:
//   - Drop the old (workspaceId, roleId) index.
//   - Backfill objectMetadataId on existing documents (NOT NULL in PG).
//     Since we cannot know the correct value, we log a warning; the app
//     must backfill with real data before going live.
//   - Create the new compound index (workspaceId, roleId, objectMetadataId).

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const migration1767998263185 = {
  name: "AddObjectMetadataIdToRowLevelPermissionPredicateGroup1767998263185",
  description:
    "Drops IDX_RLPPG_WORKSPACE_ID_ROLE_ID index, adds objectMetadataId field to " +
    "sabcrm_rowLevelPermissionPredicateGroup, and creates IDX_RLPPG_WORKSPACE_ID_ROLE_ID_OBJECT_METADATA_ID.",

  up: async (): Promise<void> => {
    const { db } = await connectToDatabase();

    // Drop the old index.
    await db
      .collection("sabcrm_rowLevelPermissionPredicateGroup")
      .dropIndex("IDX_RLPPG_WORKSPACE_ID_ROLE_ID")
      .catch(() => {
        /* ignore if absent */
      });

    // Create the new compound index.
    await db
      .collection("sabcrm_rowLevelPermissionPredicateGroup")
      .createIndex(
        { workspaceId: 1, roleId: 1, objectMetadataId: 1 },
        { name: "IDX_RLPPG_WORKSPACE_ID_ROLE_ID_OBJECT_METADATA_ID" }
      );

    // objectMetadataId is NOT NULL in PG. Existing Mongo docs without the field
    // should be backfilled by application code before deploying. We log a warning.
    const missing = await db
      .collection("sabcrm_rowLevelPermissionPredicateGroup")
      .countDocuments({ objectMetadataId: { $exists: false } });

    if (missing > 0) {
      console.warn(
        `[migration1767998263185] ${missing} sabcrm_rowLevelPermissionPredicateGroup documents ` +
          "are missing objectMetadataId — backfill required before this field is enforced."
      );
    }
  },

  down: async (): Promise<void> => {
    const { db } = await connectToDatabase();

    // Drop the new index.
    await db
      .collection("sabcrm_rowLevelPermissionPredicateGroup")
      .dropIndex("IDX_RLPPG_WORKSPACE_ID_ROLE_ID_OBJECT_METADATA_ID")
      .catch(() => {
        /* ignore if absent */
      });

    // Unset the field.
    await db
      .collection("sabcrm_rowLevelPermissionPredicateGroup")
      .updateMany({}, { $unset: { objectMetadataId: "" } });

    // Restore the old index.
    await db
      .collection("sabcrm_rowLevelPermissionPredicateGroup")
      .createIndex(
        { workspaceId: 1, roleId: 1 },
        { name: "IDX_RLPPG_WORKSPACE_ID_ROLE_ID" }
      );
  },
};
