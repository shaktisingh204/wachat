import "server-only";

import type { Collection } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import type {
  FlatDeleteSkillAction,
  UniversalDeleteSkillAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/skill/types/workspace-migration-skill-action.type";
import { transpileUniversalDeleteActionToFlatDeleteAction } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS DeleteSkillActionHandlerService — drops @Injectable DI,
// replaces TypeORM repository.delete with Mongo deleteOne on sabcrm_skill.

export const deleteSkillTranspile = async (
  context: WorkspaceMigrationActionRunnerArgs<UniversalDeleteSkillAction>,
): Promise<FlatDeleteSkillAction> => {
  return transpileUniversalDeleteActionToFlatDeleteAction(context);
};

export const deleteSkillExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatDeleteSkillAction>,
): Promise<void> => {
  const { flatAction, workspaceId } = context;

  const { db } = await connectToDatabase();
  const collection: Collection = db.collection("sabcrm_skill");

  await collection.deleteOne({
    id: flatAction.entityId,
    workspaceId,
  });
};

export const deleteSkillExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
