import "server-only";

import type { Collection } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import type {
  FlatDeleteViewFieldGroupAction,
  UniversalDeleteViewFieldGroupAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/view-field-group/types/workspace-migration-view-field-group-action.type";
import { transpileUniversalDeleteActionToFlatDeleteAction } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS DeleteViewFieldGroupActionHandlerService — drops @Injectable DI,
// replaces TypeORM repository.delete with Mongo deleteOne on sabcrm_view_field_group.

export const deleteViewFieldGroupTranspile = async (
  context: WorkspaceMigrationActionRunnerArgs<UniversalDeleteViewFieldGroupAction>,
): Promise<FlatDeleteViewFieldGroupAction> => {
  return transpileUniversalDeleteActionToFlatDeleteAction(context);
};

export const deleteViewFieldGroupExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatDeleteViewFieldGroupAction>,
): Promise<void> => {
  const { flatAction, workspaceId } = context;

  const { db } = await connectToDatabase();
  const collection: Collection = db.collection("sabcrm_view_field_group");

  await collection.deleteOne({
    id: flatAction.entityId,
    workspaceId,
  });
};

export const deleteViewFieldGroupExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
