// @license Enterprise

import "server-only";

import type { Collection } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import type {
  FlatDeleteRowLevelPermissionPredicateAction,
  UniversalDeleteRowLevelPermissionPredicateAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/row-level-permission-predicate/types/workspace-migration-row-level-permission-predicate-action.type";
import { transpileUniversalDeleteActionToFlatDeleteAction } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS DeleteRowLevelPermissionPredicateActionHandlerService — drops @Injectable DI.

export const deleteRowLevelPermissionPredicateTranspile = async (
  context: WorkspaceMigrationActionRunnerArgs<UniversalDeleteRowLevelPermissionPredicateAction>,
): Promise<FlatDeleteRowLevelPermissionPredicateAction> => {
  return transpileUniversalDeleteActionToFlatDeleteAction(context);
};

export const deleteRowLevelPermissionPredicateExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatDeleteRowLevelPermissionPredicateAction>,
): Promise<void> => {
  const { flatAction, workspaceId } = context;

  const { db } = await connectToDatabase();
  const collection: Collection = db.collection(
    "sabcrm_row_level_permission_predicate",
  );

  await collection.deleteOne({
    id: flatAction.entityId,
    workspaceId,
  });
};

export const deleteRowLevelPermissionPredicateExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
