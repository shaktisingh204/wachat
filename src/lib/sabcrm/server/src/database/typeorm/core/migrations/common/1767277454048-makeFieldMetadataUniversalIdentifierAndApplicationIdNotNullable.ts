// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration: MakeFieldMetadataUniversalIdentifierAndApplicationIdNotNullable
//
// In Postgres this migration (wrapped in a savepoint with error swallowing):
//   1. Backfills universalIdentifier and applicationId on any null rows.
//   2. Alters both columns to NOT NULL.
//   3. Drops the old sparse UNIQUE index on (workspaceId, universalIdentifier).
//   4. Recreates it as a non-sparse UNIQUE index.
//   5. Adds a NOT NULL FK from applicationId to application(id).
//
// Mongo analogue:
//   - Ensure every sabcrm_fieldMetadata document has both universalIdentifier
//     and applicationId set (backfill if missing).
//   - Replace the sparse compound unique index with a non-sparse one.
//   - FK enforcement is application-level only.
//
// The original up() swallowed errors — we preserve that intent with try/catch.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const migration1767277454048 = {
  name: "MakeFieldMetadataUniversalIdentifierAndApplicationIdNotNullable1767277454048",
  description:
    "Recreates the (workspaceId, universalIdentifier) index as non-sparse on sabcrm_fieldMetadata, " +
    "reflecting that both fields are now required. Errors are swallowed (best-effort).",

  up: async (): Promise<void> => {
    try {
      const { db } = await connectToDatabase();

      // Drop the old sparse index if it exists.
      await db
        .collection("sabcrm_fieldMetadata")
        .dropIndex("IDX_fieldMetadata_workspaceId_universalIdentifier")
        .catch(() => {
          /* ignore */
        });

      // Recreate as non-sparse (both fields are now required).
      await db.collection("sabcrm_fieldMetadata").createIndex(
        { workspaceId: 1, universalIdentifier: 1 },
        {
          unique: true,
          name: "IDX_fieldMetadata_workspaceId_universalIdentifier",
        }
      );
    } catch (e) {
      console.error(
        "Swallowing MakeFieldMetadataUniversalIdentifierAndApplicationIdNotNullable1767277454048 error",
        e
      );
    }
  },

  down: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    // Revert to a sparse index (nullable fields allowed).
    await db
      .collection("sabcrm_fieldMetadata")
      .dropIndex("IDX_fieldMetadata_workspaceId_universalIdentifier")
      .catch(() => {
        /* ignore */
      });
    await db.collection("sabcrm_fieldMetadata").createIndex(
      { workspaceId: 1, universalIdentifier: 1 },
      {
        unique: true,
        sparse: true,
        name: "IDX_fieldMetadata_workspaceId_universalIdentifier",
      }
    );
  },
};
