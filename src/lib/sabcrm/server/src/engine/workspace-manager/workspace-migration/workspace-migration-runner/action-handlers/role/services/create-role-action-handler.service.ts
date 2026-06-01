import "server-only";

import { v4 } from "uuid";

import { getUniversalFlatEntityEmptyForeignKeyAggregators } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/reset-universal-flat-entity-foreign-key-aggregators.util";
import type {
  FlatCreateRoleAction,
  UniversalCreateRoleAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/role/types/workspace-migration-role-action.type";
import { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS CreateRoleActionHandlerService — drops @Injectable DI.

export const createRoleTranspile = async ({
  action,
  flatApplication,
  workspaceId,
}: WorkspaceMigrationActionRunnerArgs<UniversalCreateRoleAction>): Promise<FlatCreateRoleAction> => {
  const emptyUniversalForeignKeyAggregators =
    getUniversalFlatEntityEmptyForeignKeyAggregators({
      metadataName: "role",
    });

  return {
    ...action,
    flatEntity: {
      ...action.flatEntity,
      applicationId: flatApplication.id,
      id: action.id ?? v4(),
      workspaceId,
      roleTargetIds: [],
      rowLevelPermissionPredicateIds: [],
      rowLevelPermissionPredicateGroupIds: [],
      objectPermissionIds: [],
      rolePermissionFlagIds: [],
      fieldPermissionIds: [],
      ...emptyUniversalForeignKeyAggregators,
    },
  };
};

export const createRoleExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatCreateRoleAction>,
): Promise<void> => {
  const { flatAction, queryRunner } = context;
  const { flatEntity } = flatAction;

  await WorkspaceMigrationRunnerActionHandler.insertFlatEntitiesInRepository({
    queryRunner,
    flatEntities: [flatEntity],
  });
};

export const createRoleExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
