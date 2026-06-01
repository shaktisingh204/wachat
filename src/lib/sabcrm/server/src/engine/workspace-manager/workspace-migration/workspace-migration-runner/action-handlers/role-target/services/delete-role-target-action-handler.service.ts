import "server-only";

import type { Collection } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import type {
  FlatDeleteRoleTargetAction,
  UniversalDeleteRoleTargetAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/role-target/types/workspace-migration-role-target-action.type";
import { transpileUniversalDeleteActionToFlatDeleteAction } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS DeleteRoleTargetActionHandlerService — drops @Injectable DI,
// replaces TypeORM repository.delete with Mongo deleteOne.

export const deleteRoleTargetTranspile = async (
  context: WorkspaceMigrationActionRunnerArgs<UniversalDeleteRoleTargetAction>,
): Promise<FlatDeleteRoleTargetAction> => {
  return transpileUniversalDeleteActionToFlatDeleteAction(context);
};

export const deleteRoleTargetExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatDeleteRoleTargetAction>,
): Promise<void> => {
  const { flatAction, workspaceId } = context;

  const { db } = await connectToDatabase();
  const collection: Collection = db.collection("sabcrm_role_target");

  await collection.deleteOne({
    id: flatAction.entityId,
    workspaceId,
  });
};

export const deleteRoleTargetExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
