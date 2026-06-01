import "server-only";

import type { Collection } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import type {
  FlatDeletePermissionFlagAction,
  UniversalDeletePermissionFlagAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/permission-flag/types/workspace-migration-permission-flag-action.type";
import { transpileUniversalDeleteActionToFlatDeleteAction } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS DeletePermissionFlagActionHandlerService — drops @Injectable DI,
// replaces TypeORM repository.delete with Mongo deleteOne filtered by id + workspaceId.

export const deletePermissionFlagTranspile = async (
  context: WorkspaceMigrationActionRunnerArgs<UniversalDeletePermissionFlagAction>,
): Promise<FlatDeletePermissionFlagAction> => {
  return transpileUniversalDeleteActionToFlatDeleteAction(context);
};

export const deletePermissionFlagExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatDeletePermissionFlagAction>,
): Promise<void> => {
  const { flatAction, workspaceId } = context;

  const { db } = await connectToDatabase();
  const collection: Collection = db.collection("sabcrm_permission_flag");

  await collection.deleteOne({
    id: flatAction.entityId,
    workspaceId,
  });
};

export const deletePermissionFlagExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
