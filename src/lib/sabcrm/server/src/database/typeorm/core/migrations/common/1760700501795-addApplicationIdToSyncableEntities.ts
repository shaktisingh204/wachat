// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: adds universalIdentifier and/or applicationId columns to many core tables
//         (agent, role, viewFilter, viewFilterGroup, viewGroup, viewSort, view, objectMetadata,
//          indexMetadata, fieldMetadata, viewField, cronTrigger, databaseEventTrigger, routeTrigger);
//         creates sparse unique compound indexes for (workspaceId, universalIdentifier) on agent, role,
//         objectMetadata, fieldMetadata; adds FK constraints (app-layer in Mongo).

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

/**
 * Migration 1760700501795 – AddApplicationIdToSyncableEntities
 *
 * Postgres intent (abbreviated):
 *   - ADD universalIdentifier uuid, applicationId uuid to: agent, role, viewFilter, viewFilterGroup,
 *     viewGroup, viewSort, view, objectMetadata (universalIdentifier only), indexMetadata (applicationId only),
 *     fieldMetadata, viewField, cronTrigger, databaseEventTrigger, routeTrigger.
 *   - CREATE UNIQUE INDEX (workspaceId, universalIdentifier) on agent, role, objectMetadata, fieldMetadata.
 *   - ADD FK constraints to application (CASCADE) for role, viewFilter, viewFilterGroup, viewGroup, viewSort,
 *     view, indexMetadata, fieldMetadata, viewField, cronTrigger, databaseEventTrigger, routeTrigger.
 *
 * Mongo equivalent:
 *   - All listed collections gain optional `universalIdentifier` and/or `applicationId` string fields
 *     at the document level — no DDL needed for the fields themselves.
 *   - Sparse unique compound indexes are created where the Postgres migration created UNIQUE INDEXes.
 */

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();

  const sparseUniqueTargets: string[] = [
    "sabcrm_agent",
    "sabcrm_role",
    "sabcrm_objectMetadata",
    "sabcrm_fieldMetadata",
  ];

  for (const collectionName of sparseUniqueTargets) {
    const collection = db.collection(collectionName);
    await collection.createIndex(
      { workspaceId: 1, universalIdentifier: 1 },
      {
        unique: true,
        sparse: true,
        name: `IDX_${collectionName.replace("sabcrm_", "")}_workspaceId_universalIdentifier_unique`,
      },
    );
  }
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();

  const sparseUniqueTargets: string[] = [
    "sabcrm_agent",
    "sabcrm_role",
    "sabcrm_objectMetadata",
    "sabcrm_fieldMetadata",
  ];

  for (const collectionName of sparseUniqueTargets) {
    const collection = db.collection(collectionName);
    try {
      await collection.dropIndex(
        `IDX_${collectionName.replace("sabcrm_", "")}_workspaceId_universalIdentifier_unique`,
      );
    } catch {
      // Safe to ignore if index doesn't exist
    }
  }
}

export const migrationNote = {
  id: "1760700501795",
  name: "AddApplicationIdToSyncableEntities",
  mongoEquivalent:
    "sparse unique indexes on { workspaceId, universalIdentifier } for agent, role, objectMetadata, fieldMetadata; applicationId fields are schema-less no-ops",
} as const;
