import "server-only";

import type { Collection } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import type {
  FlatDeleteRoleAction,
  UniversalDeleteRoleAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/role/types/workspace-migration-role-action.type";
import { transpileUniversalDeleteActionToFlatDeleteAction } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS DeleteRoleActionHandlerService — drops @Injectable DI,
// replaces TypeORM repository.delete with Mongo deleteOne on sabcrm_role.

export const deleteRoleTranspile = async (
  context: WorkspaceMigrationActionRunnerArgs<UniversalDeleteRoleAction>,
): Promise<FlatDeleteRoleAction> => {
  return transpileUniversalDeleteActionToFlatDeleteAction(context);
};

export const deleteRoleExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatDeleteRoleAction>,
): Promise<void> => {
  const { flatAction, workspaceId } = context;

  const { db } = await connectToDatabase();
  const collection: Collection = db.collection("sabcrm_role");

  await collection.deleteOne({
    id: flatAction.entityId,
    workspaceId,
  });
};

export const deleteRoleExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
