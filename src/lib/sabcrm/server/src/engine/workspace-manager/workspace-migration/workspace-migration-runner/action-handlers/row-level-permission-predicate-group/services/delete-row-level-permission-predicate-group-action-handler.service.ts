// @license Enterprise

import "server-only";

import type { Collection } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import type {
  FlatDeleteRowLevelPermissionPredicateGroupAction,
  UniversalDeleteRowLevelPermissionPredicateGroupAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/row-level-permission-predicate-group/types/workspace-migration-row-level-permission-predicate-group-action.type";
import { transpileUniversalDeleteActionToFlatDeleteAction } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS DeleteRowLevelPermissionPredicateGroupActionHandlerService — drops @Injectable DI.

export const deleteRowLevelPermissionPredicateGroupTranspile = async (
  context: WorkspaceMigrationActionRunnerArgs<UniversalDeleteRowLevelPermissionPredicateGroupAction>,
): Promise<FlatDeleteRowLevelPermissionPredicateGroupAction> => {
  return transpileUniversalDeleteActionToFlatDeleteAction(context);
};

export const deleteRowLevelPermissionPredicateGroupExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatDeleteRowLevelPermissionPredicateGroupAction>,
): Promise<void> => {
  const { flatAction, workspaceId } = context;

  const { db } = await connectToDatabase();
  const collection: Collection = db.collection(
    "sabcrm_row_level_permission_predicate_group",
  );

  await collection.deleteOne({
    id: flatAction.entityId,
    workspaceId,
  });
};

export const deleteRowLevelPermissionPredicateGroupExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
