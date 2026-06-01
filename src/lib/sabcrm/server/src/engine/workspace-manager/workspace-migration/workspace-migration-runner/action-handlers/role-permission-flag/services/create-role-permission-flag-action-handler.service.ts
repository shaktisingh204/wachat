import "server-only";

import { v4 } from "uuid";

import { resolveUniversalRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-relation-identifiers-to-ids.util";
import type {
  FlatCreateRolePermissionFlagAction,
  UniversalCreateRolePermissionFlagAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/role-permission-flag/types/workspace-migration-role-permission-flag-action.type";
import { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS CreateRolePermissionFlagActionHandlerService — drops @Injectable DI.

export const createRolePermissionFlagTranspile = async ({
  action,
  allFlatEntityMaps,
  flatApplication,
  workspaceId,
}: WorkspaceMigrationActionRunnerArgs<UniversalCreateRolePermissionFlagAction>): Promise<FlatCreateRolePermissionFlagAction> => {
  const relationIds = resolveUniversalRelationIdentifiersToIds({
    flatEntityMaps: allFlatEntityMaps,
    metadataName: action.metadataName,
    universalForeignKeyValues: action.flatEntity,
  });

  return {
    ...action,
    flatEntity: {
      ...action.flatEntity,
      ...relationIds,
      applicationId: flatApplication.id,
      id: action.id ?? v4(),
      workspaceId,
    },
  };
};

export const createRolePermissionFlagExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatCreateRolePermissionFlagAction>,
): Promise<void> => {
  const { flatAction, queryRunner } = context;
  const { flatEntity } = flatAction;

  await WorkspaceMigrationRunnerActionHandler.insertFlatEntitiesInRepository({
    queryRunner,
    flatEntities: [flatEntity],
  });
};

export const createRolePermissionFlagExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
