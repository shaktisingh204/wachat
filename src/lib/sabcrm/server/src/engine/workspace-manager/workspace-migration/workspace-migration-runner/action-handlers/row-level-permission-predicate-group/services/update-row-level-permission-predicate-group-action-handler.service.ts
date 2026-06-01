// @license Enterprise

import "server-only";

import type { Collection } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { findFlatEntityByUniversalIdentifierOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util";
import { resolveUniversalUpdateRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-update-relation-identifiers-to-ids.util";
import type {
  FlatUpdateRowLevelPermissionPredicateGroupAction,
  UniversalUpdateRowLevelPermissionPredicateGroupAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/row-level-permission-predicate-group/types/workspace-migration-row-level-permission-predicate-group-action.type";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS UpdateRowLevelPermissionPredicateGroupActionHandlerService — drops @Injectable DI.

export const updateRowLevelPermissionPredicateGroupTranspile = async (
  context: WorkspaceMigrationActionRunnerArgs<UniversalUpdateRowLevelPermissionPredicateGroupAction>,
): Promise<FlatUpdateRowLevelPermissionPredicateGroupAction> => {
  const { action, allFlatEntityMaps } = context;

  const flatRowLevelPermissionPredicateGroup =
    findFlatEntityByUniversalIdentifierOrThrow({
      flatEntityMaps:
        allFlatEntityMaps.flatRowLevelPermissionPredicateGroupMaps,
      universalIdentifier: action.universalIdentifier,
    });

  const update = resolveUniversalUpdateRelationIdentifiersToIds({
    metadataName: "rowLevelPermissionPredicateGroup",
    universalUpdate: action.update,
    allFlatEntityMaps,
  });

  return {
    type: "update",
    metadataName: "rowLevelPermissionPredicateGroup",
    entityId: flatRowLevelPermissionPredicateGroup.id,
    update,
  };
};

export const updateRowLevelPermissionPredicateGroupExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatUpdateRowLevelPermissionPredicateGroupAction>,
): Promise<void> => {
  const { flatAction, workspaceId } = context;
  const { entityId, update } = flatAction;

  const { db } = await connectToDatabase();
  const collection: Collection = db.collection(
    "sabcrm_row_level_permission_predicate_group",
  );

  await collection.updateOne({ id: entityId, workspaceId }, { $set: update });
};

export const updateRowLevelPermissionPredicateGroupExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
