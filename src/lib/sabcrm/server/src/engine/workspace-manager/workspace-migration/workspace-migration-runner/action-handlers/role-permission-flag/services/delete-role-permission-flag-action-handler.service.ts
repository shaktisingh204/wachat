import "server-only";

import type { Collection } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import type {
  FlatDeleteRolePermissionFlagAction,
  UniversalDeleteRolePermissionFlagAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/role-permission-flag/types/workspace-migration-role-permission-flag-action.type";
import { transpileUniversalDeleteActionToFlatDeleteAction } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS DeleteRolePermissionFlagActionHandlerService — drops @Injectable DI,
// replaces TypeORM repository.delete with Mongo deleteOne.

export const deleteRolePermissionFlagTranspile = async (
  context: WorkspaceMigrationActionRunnerArgs<UniversalDeleteRolePermissionFlagAction>,
): Promise<FlatDeleteRolePermissionFlagAction> => {
  return transpileUniversalDeleteActionToFlatDeleteAction(context);
};

export const deleteRolePermissionFlagExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatDeleteRolePermissionFlagAction>,
): Promise<void> => {
  const { flatAction, workspaceId } = context;

  const { db } = await connectToDatabase();
  const collection: Collection = db.collection("sabcrm_role_permission_flag");

  await collection.deleteOne({
    id: flatAction.entityId,
    workspaceId,
  });
};

export const deleteRolePermissionFlagExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
