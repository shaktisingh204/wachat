import "server-only";

import { v4 } from "uuid";

import { getUniversalFlatEntityEmptyForeignKeyAggregators } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/reset-universal-flat-entity-foreign-key-aggregators.util";
import type {
  FlatCreatePermissionFlagAction,
  UniversalCreatePermissionFlagAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/permission-flag/types/workspace-migration-permission-flag-action.type";
import { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS CreatePermissionFlagActionHandlerService — drops @Injectable DI
export const createPermissionFlagTranspile = async ({
  action,
  flatApplication,
  workspaceId,
}: WorkspaceMigrationActionRunnerArgs<UniversalCreatePermissionFlagAction>): Promise<FlatCreatePermissionFlagAction> => {
  const emptyUniversalForeignKeyAggregators =
    getUniversalFlatEntityEmptyForeignKeyAggregators({
      metadataName: "permissionFlag",
    });

  return {
    ...action,
    flatEntity: {
      ...action.flatEntity,
      applicationId: flatApplication.id,
      id: action.id ?? v4(),
      workspaceId,
      rolePermissionFlagIds: [],
      ...emptyUniversalForeignKeyAggregators,
    },
  };
};

export const createPermissionFlagExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatCreatePermissionFlagAction>,
): Promise<void> => {
  const { flatAction, queryRunner } = context;
  const { flatEntity } = flatAction;

  await WorkspaceMigrationRunnerActionHandler.insertFlatEntitiesInRepository({
    queryRunner,
    flatEntities: [flatEntity],
  });
};

export const createPermissionFlagExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
