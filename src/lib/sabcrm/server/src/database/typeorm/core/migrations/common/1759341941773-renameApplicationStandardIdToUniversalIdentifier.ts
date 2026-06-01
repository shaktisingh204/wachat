// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: core."application" table — renames column standardId -> universalIdentifier;
//         drops old unique index; creates new partial unique index on (universalIdentifier, workspaceId)
//         WHERE deletedAt IS NULL AND universalIdentifier IS NOT NULL.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

/**
 * Migration 1759341941773 – RenameApplicationStandardIdToUniversalIdentifier
 *
 * Postgres intent:
 *   UP:   DROP INDEX IDX_APPLICATION_STANDARD_ID_WORKSPACE_ID_UNIQUE;
 *         ALTER TABLE core.application RENAME COLUMN standardId TO universalIdentifier;
 *         CREATE UNIQUE INDEX IDX_APPLICATION_UNIVERSAL_IDENTIFIER_WORKSPACE_ID_UNIQUE
 *           ON core.application (universalIdentifier, workspaceId) WHERE deletedAt IS NULL AND universalIdentifier IS NOT NULL;
 *   DOWN: reverse of the above.
 *
 * Mongo equivalent:
 *   - Drop the old index on { standardId, workspaceId } if present.
 *   - Rename field `standardId` -> `universalIdentifier` in all documents (one-off update).
 *   - Create a sparse partial unique index on { universalIdentifier, workspaceId } (documents where
 *     deletedAt does not exist and universalIdentifier exists).
 *
 * One-off document rename (run once):
 *   db.sabcrm_application.updateMany(
 *     { standardId: { $exists: true } },
 *     [{ $set: { universalIdentifier: "$standardId" } }, { $unset: "standardId" }]
 *   );
 */

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_application");

  // Drop old index if it exists (best-effort)
  try {
    await collection.dropIndex(
      "IDX_application_standardId_workspaceId_unique",
    );
  } catch {
    // Index may not exist — safe to ignore
  }

  // Partial sparse unique index: only non-deleted, non-null universalIdentifier values must be unique
  await collection.createIndex(
    { universalIdentifier: 1, workspaceId: 1 },
    {
      unique: true,
      sparse: true,
      partialFilterExpression: {
        deletedAt: { $exists: false },
        universalIdentifier: { $exists: true, $type: "string" },
      },
      name: "IDX_application_universalIdentifier_workspaceId_unique",
    },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_application");

  try {
    await collection.dropIndex(
      "IDX_application_universalIdentifier_workspaceId_unique",
    );
  } catch {
    // Safe to ignore
  }

  await collection.createIndex(
    { standardId: 1, workspaceId: 1 },
    {
      unique: true,
      sparse: true,
      partialFilterExpression: {
        deletedAt: { $exists: false },
        standardId: { $exists: true, $type: "string" },
      },
      name: "IDX_application_standardId_workspaceId_unique",
    },
  );
}

export const migrationNote = {
  id: "1759341941773",
  name: "RenameApplicationStandardIdToUniversalIdentifier",
  mongoEquivalent:
    "field rename standardId->universalIdentifier + partial unique index on { universalIdentifier, workspaceId } for non-deleted docs",
} as const;
