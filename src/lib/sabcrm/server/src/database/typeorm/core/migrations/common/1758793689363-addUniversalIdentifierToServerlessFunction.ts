// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: core."serverlessFunction" table — adds universalIdentifier uuid, applicationId uuid columns +
//         unique index on (workspaceId, universalIdentifier).

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

/**
 * Migration 1758793689363 – AddUniversalIdentifierToServerlessFunction
 *
 * Postgres intent:
 *   UP:   ALTER TABLE core.serverlessFunction ADD universalIdentifier uuid;
 *         ALTER TABLE core.serverlessFunction ADD applicationId uuid;
 *         CREATE UNIQUE INDEX IDX_5b43e65e322d516c9307bed97a ON core.serverlessFunction (workspaceId, universalIdentifier);
 *   DOWN: DROP INDEX; DROP COLUMNs.
 *
 * Mongo equivalent:
 *   - sabcrm_serverlessFunction documents gain optional `universalIdentifier` and `applicationId` fields.
 *   - Sparse unique compound index on { workspaceId, universalIdentifier }.
 */

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_serverlessFunction");

  await collection.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    {
      unique: true,
      sparse: true,
      name: "IDX_serverlessFunction_workspaceId_universalIdentifier_unique",
    },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_serverlessFunction")
    .dropIndex(
      "IDX_serverlessFunction_workspaceId_universalIdentifier_unique",
    );
}

export const migrationNote = {
  id: "1758793689363",
  name: "AddUniversalIdentifierToServerlessFunction",
  mongoEquivalent:
    "sparse unique index on { workspaceId, universalIdentifier } in sabcrm_serverlessFunction",
} as const;
