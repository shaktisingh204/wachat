// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: creates core."serverlessFunctionLayer" table; adds serverlessFunctionLayerId to serverlessFunction +
//         application; wires FK constraints between agent, serverlessFunction, application, objectMetadata.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

/**
 * Migration 1759236947406 – UpdateServerlessFunctionLayerEntity
 *
 * Postgres intent:
 *   UP:   CREATE TABLE core.serverlessFunctionLayer (id uuid PK, packageJson jsonb NOT NULL,
 *           yarnLock text NOT NULL, checksum text NOT NULL, workspaceId uuid NOT NULL,
 *           createdAt timestamptz, updatedAt timestamptz);
 *         ALTER TABLE core.serverlessFunction ADD serverlessFunctionLayerId uuid;
 *         ALTER TABLE core.application ADD serverlessFunctionLayerId uuid NOT NULL;
 *         UNIQUE on application.serverlessFunctionLayerId;
 *         FK: agent.applicationId -> application(id) ON DELETE CASCADE;
 *         FK: serverlessFunction.serverlessFunctionLayerId -> serverlessFunctionLayer(id);
 *         FK: serverlessFunction.applicationId -> application(id) ON DELETE CASCADE;
 *         FK: application.serverlessFunctionLayerId -> serverlessFunctionLayer(id) ON DELETE CASCADE;
 *         FK: objectMetadata.applicationId -> application(id) ON DELETE CASCADE.
 *   DOWN: reverse all of the above.
 *
 * Mongo equivalent:
 *   - New collection: sabcrm_serverlessFunctionLayer
 *   - Index on { workspaceId } for filtered lookups
 *   - Other fields (packageJson, yarnLock, checksum) are document-level; no extra indexes needed.
 *   - FK relationships are enforced at the application layer, not DB level.
 */

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const layerCollection = db.collection("sabcrm_serverlessFunctionLayer");

  await layerCollection.createIndex(
    { workspaceId: 1 },
    { name: "IDX_serverlessFunctionLayer_workspaceId" },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection("sabcrm_serverlessFunctionLayer").drop();
}

export const migrationNote = {
  id: "1759236947406",
  name: "UpdateServerlessFunctionLayerEntity",
  mongoEquivalent:
    "sabcrm_serverlessFunctionLayer collection + workspaceId index; FK constraints are application-layer only",
} as const;
