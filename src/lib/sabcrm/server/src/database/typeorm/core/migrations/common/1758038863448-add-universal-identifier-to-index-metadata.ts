// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: core."indexMetadata" table — adds "universalIdentifier" uuid column + unique index on (workspaceId, universalIdentifier).

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

/**
 * Migration 1758038863448 – AddUniversalIdentifierToIndexMetadata
 *
 * Postgres intent:
 *   UP:   ALTER TABLE core.indexMetadata ADD universalIdentifier uuid;
 *         CREATE UNIQUE INDEX IDX_b27c681286ac581f81498c5d4b ON core.indexMetadata (workspaceId, universalIdentifier);
 *   DOWN: DROP INDEX; DROP COLUMN.
 *
 * Mongo equivalent:
 *   - Ensure the sabcrm_indexMetadata collection has a sparse unique compound index on
 *     { workspaceId, universalIdentifier } (sparse so null values don't conflict).
 */

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_indexMetadata");

  await collection.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    {
      unique: true,
      sparse: true,
      name: "IDX_indexMetadata_workspaceId_universalIdentifier_unique",
    },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_indexMetadata");

  await collection.dropIndex(
    "IDX_indexMetadata_workspaceId_universalIdentifier_unique",
  );
}

export const migrationNote = {
  id: "1758038863448",
  name: "AddUniversalIdentifierToIndexMetadata",
  mongoEquivalent:
    "sparse unique compound index on { workspaceId, universalIdentifier }",
} as const;
