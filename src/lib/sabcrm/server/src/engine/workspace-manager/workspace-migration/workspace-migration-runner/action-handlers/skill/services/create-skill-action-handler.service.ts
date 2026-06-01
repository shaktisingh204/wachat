import "server-only";

import { v4 } from "uuid";

import { getUniversalFlatEntityEmptyForeignKeyAggregators } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/reset-universal-flat-entity-foreign-key-aggregators.util";
import type {
  FlatCreateSkillAction,
  UniversalCreateSkillAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/skill/types/workspace-migration-skill-action.type";
import { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS CreateSkillActionHandlerService — drops @Injectable DI.

export const createSkillTranspile = async ({
  action,
  flatApplication,
  workspaceId,
}: WorkspaceMigrationActionRunnerArgs<UniversalCreateSkillAction>): Promise<FlatCreateSkillAction> => {
  const emptyUniversalForeignKeyAggregators =
    getUniversalFlatEntityEmptyForeignKeyAggregators({
      metadataName: "skill",
    });

  return {
    ...action,
    flatEntity: {
      ...action.flatEntity,
      applicationId: flatApplication.id,
      id: action.id ?? v4(),
      workspaceId,
      ...emptyUniversalForeignKeyAggregators,
    },
  };
};

export const createSkillExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatCreateSkillAction>,
): Promise<void> => {
  const { flatAction, queryRunner } = context;
  const { flatEntity } = flatAction;

  await WorkspaceMigrationRunnerActionHandler.insertFlatEntitiesInRepository({
    queryRunner,
    flatEntities: [flatEntity],
  });
};

export const createSkillExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
