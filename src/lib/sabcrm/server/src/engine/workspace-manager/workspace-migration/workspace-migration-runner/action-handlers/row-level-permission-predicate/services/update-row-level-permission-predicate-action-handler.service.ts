// @license Enterprise

import "server-only";

import type { Collection } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { findFlatEntityByUniversalIdentifierOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util";
import { resolveUniversalUpdateRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-update-relation-identifiers-to-ids.util";
import type {
  FlatUpdateRowLevelPermissionPredicateAction,
  UniversalUpdateRowLevelPermissionPredicateAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/row-level-permission-predicate/types/workspace-migration-row-level-permission-predicate-action.type";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS UpdateRowLevelPermissionPredicateActionHandlerService — drops @Injectable DI.

export const updateRowLevelPermissionPredicateTranspile = async (
  context: WorkspaceMigrationActionRunnerArgs<UniversalUpdateRowLevelPermissionPredicateAction>,
): Promise<FlatUpdateRowLevelPermissionPredicateAction> => {
  const { action, allFlatEntityMaps } = context;

  const flatRowLevelPermissionPredicate =
    findFlatEntityByUniversalIdentifierOrThrow({
      flatEntityMaps: allFlatEntityMaps.flatRowLevelPermissionPredicateMaps,
      universalIdentifier: action.universalIdentifier,
    });

  const update = resolveUniversalUpdateRelationIdentifiersToIds({
    metadataName: "rowLevelPermissionPredicate",
    universalUpdate: action.update,
    allFlatEntityMaps,
  });

  return {
    type: "update",
    metadataName: "rowLevelPermissionPredicate",
    entityId: flatRowLevelPermissionPredicate.id,
    update,
  };
};

export const updateRowLevelPermissionPredicateExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatUpdateRowLevelPermissionPredicateAction>,
): Promise<void> => {
  const { flatAction, workspaceId } = context;
  const { entityId, update } = flatAction;

  const { db } = await connectToDatabase();
  const collection: Collection = db.collection(
    "sabcrm_row_level_permission_predicate",
  );

  await collection.updateOne({ id: entityId, workspaceId }, { $set: update });
};

export const updateRowLevelPermissionPredicateExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
