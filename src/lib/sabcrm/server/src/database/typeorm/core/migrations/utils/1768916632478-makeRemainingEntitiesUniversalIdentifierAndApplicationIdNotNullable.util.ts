// PORT-NOTE: pg-migration->mongo-index/seed
// Original Twenty migration: makeRemainingEntitiesUniversalIdentifierAndApplicationIdNotNullable
// This migration enforces NOT NULL on universalIdentifier + applicationId and adds unique
// compound indexes on (workspaceId, universalIdentifier) for 13 remaining core tables:
//   roleTarget, rowLevelPermissionPredicate, rowLevelPermissionPredicateGroup,
//   viewFilterGroup, viewSort, cronTrigger, databaseEventTrigger, routeTrigger,
//   serverlessFunction, skill, pageLayoutWidget, pageLayout, pageLayoutTab
//
// In MongoDB, NOT NULL / FK enforcement is at the application layer. We create the
// corresponding unique compound indexes on the respective sabcrm_* collections.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

const COLLECTION_INDEX_MAP: Array<{ collection: string; indexName: string }> = [
  { collection: "sabcrm_roletarget", indexName: "IDX_roleTarget_workspaceId_universalIdentifier" },
  { collection: "sabcrm_rowlevelpermissionpredicate", indexName: "IDX_rowLevelPermissionPredicate_workspaceId_universalIdentifier" },
  { collection: "sabcrm_rowlevelpermissionpredicategroup", indexName: "IDX_rowLevelPermissionPredicateGroup_workspaceId_universalIdentifier" },
  { collection: "sabcrm_viewfiltergroup", indexName: "IDX_viewFilterGroup_workspaceId_universalIdentifier" },
  { collection: "sabcrm_viewsort", indexName: "IDX_viewSort_workspaceId_universalIdentifier" },
  { collection: "sabcrm_crontrigger", indexName: "IDX_cronTrigger_workspaceId_universalIdentifier" },
  { collection: "sabcrm_databaseeventtrigger", indexName: "IDX_databaseEventTrigger_workspaceId_universalIdentifier" },
  { collection: "sabcrm_routetrigger", indexName: "IDX_routeTrigger_workspaceId_universalIdentifier" },
  { collection: "sabcrm_serverlessfunction", indexName: "IDX_serverlessFunction_workspaceId_universalIdentifier" },
  { collection: "sabcrm_skill", indexName: "IDX_skill_workspaceId_universalIdentifier" },
  { collection: "sabcrm_pagelayoutwidget", indexName: "IDX_pageLayoutWidget_workspaceId_universalIdentifier" },
  { collection: "sabcrm_pagelayout", indexName: "IDX_pageLayout_workspaceId_universalIdentifier" },
  { collection: "sabcrm_pagelayouttab", indexName: "IDX_pageLayoutTab_workspaceId_universalIdentifier" },
];

/**
 * Ensures unique compound (workspaceId, universalIdentifier) indexes on all remaining
 * core entity collections, mirroring the Postgres migration for the 13 entities.
 */
export async function ensureRemainingEntitiesIndexes(): Promise<void> {
  const db = await connectToDatabase();

  await Promise.all(
    COLLECTION_INDEX_MAP.map(({ collection, indexName }) =>
      db.collection(collection).createIndex(
        { workspaceId: 1, universalIdentifier: 1 },
        { unique: true, sparse: false, name: indexName }
      )
    )
  );
}
