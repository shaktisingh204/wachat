import "server-only";

import { v4 } from "uuid";

import { getUniversalFlatEntityEmptyForeignKeyAggregators } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/reset-universal-flat-entity-foreign-key-aggregators.util";
import { resolveUniversalRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-relation-identifiers-to-ids.util";
import type {
  FlatCreateRoleTargetAction,
  UniversalCreateRoleTargetAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/role-target/types/workspace-migration-role-target-action.type";
import { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS CreateRoleTargetActionHandlerService — drops @Injectable DI.

export const createRoleTargetTranspile = async ({
  action,
  allFlatEntityMaps,
  flatApplication,
  workspaceId,
}: WorkspaceMigrationActionRunnerArgs<UniversalCreateRoleTargetAction>): Promise<FlatCreateRoleTargetAction> => {
  const { roleId } = resolveUniversalRelationIdentifiersToIds({
    flatEntityMaps: allFlatEntityMaps,
    metadataName: action.metadataName,
    universalForeignKeyValues: action.flatEntity,
  });

  const emptyUniversalForeignKeyAggregators =
    getUniversalFlatEntityEmptyForeignKeyAggregators({
      metadataName: "roleTarget",
    });

  return {
    ...action,
    flatEntity: {
      ...action.flatEntity,
      roleId,
      applicationId: flatApplication.id,
      id: action.id ?? v4(),
      workspaceId,
      ...emptyUniversalForeignKeyAggregators,
    },
  };
};

export const createRoleTargetExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatCreateRoleTargetAction>,
): Promise<void> => {
  const { flatAction, queryRunner } = context;
  const { flatEntity } = flatAction;

  await WorkspaceMigrationRunnerActionHandler.insertFlatEntitiesInRepository({
    queryRunner,
    flatEntities: [flatEntity],
  });
};

export const createRoleTargetExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
