// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration: MakeViewUniversalIdentifierAndApplicationIdNotNullable
//
// In Postgres (wrapped in savepoint, errors swallowed):
//   1. Backfills universalIdentifier and applicationId on any null rows.
//   2. Alters both columns to NOT NULL.
//   3. Drops the sparse UNIQUE index on (workspaceId, universalIdentifier).
//   4. Recreates it as a non-sparse UNIQUE index.
//   5. Adds NOT NULL FK from applicationId to application(id).
//
// Mongo analogue:
//   - Drop the sparse index and recreate as non-sparse.
//   - Errors swallowed (mirrors original).

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const migration1768213174271 = {
  name: "MakeViewUniversalIdentifierAndApplicationIdNotNullable1768213174271",
  description:
    "Recreates the (workspaceId, universalIdentifier) index as non-sparse on sabcrm_view, " +
    "reflecting that both fields are now required. Errors are swallowed (best-effort).",

  up: async (): Promise<void> => {
    try {
      const { db } = await connectToDatabase();

      // Drop the old sparse index.
      await db
        .collection("sabcrm_view")
        .dropIndex("IDX_view_workspaceId_universalIdentifier")
        .catch(() => {
          /* ignore */
        });

      // Recreate as non-sparse.
      await db.collection("sabcrm_view").createIndex(
        { workspaceId: 1, universalIdentifier: 1 },
        {
          unique: true,
          name: "IDX_view_workspaceId_universalIdentifier",
        }
      );
    } catch (e) {
      console.error(
        "Swallowing MakeViewUniversalIdentifierAndApplicationIdNotNullable1768213174271 error",
        e
      );
    }
  },

  down: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db
      .collection("sabcrm_view")
      .dropIndex("IDX_view_workspaceId_universalIdentifier")
      .catch(() => {
        /* ignore */
      });
    await db.collection("sabcrm_view").createIndex(
      { workspaceId: 1, universalIdentifier: 1 },
      {
        unique: true,
        sparse: true,
        name: "IDX_view_workspaceId_universalIdentifier",
      }
    );
  },
};
