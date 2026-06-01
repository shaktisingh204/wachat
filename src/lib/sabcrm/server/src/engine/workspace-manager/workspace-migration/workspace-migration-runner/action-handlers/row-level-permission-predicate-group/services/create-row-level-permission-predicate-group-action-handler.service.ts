// @license Enterprise

import "server-only";

import { v4 } from "uuid";

import { getUniversalFlatEntityEmptyForeignKeyAggregators } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/reset-universal-flat-entity-foreign-key-aggregators.util";
import { resolveUniversalRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-relation-identifiers-to-ids.util";
import type {
  FlatCreateRowLevelPermissionPredicateGroupAction,
  UniversalCreateRowLevelPermissionPredicateGroupAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/row-level-permission-predicate-group/types/workspace-migration-row-level-permission-predicate-group-action.type";
import { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS CreateRowLevelPermissionPredicateGroupActionHandlerService — drops @Injectable DI.

export const createRowLevelPermissionPredicateGroupTranspile = async ({
  action,
  allFlatEntityMaps,
  flatApplication,
  workspaceId,
}: WorkspaceMigrationActionRunnerArgs<UniversalCreateRowLevelPermissionPredicateGroupAction>): Promise<FlatCreateRowLevelPermissionPredicateGroupAction> => {
  const {
    objectMetadataId,
    roleId,
    parentRowLevelPermissionPredicateGroupId,
  } = resolveUniversalRelationIdentifiersToIds({
    flatEntityMaps: allFlatEntityMaps,
    metadataName: action.metadataName,
    universalForeignKeyValues: action.flatEntity,
  });

  const emptyUniversalForeignKeyAggregators =
    getUniversalFlatEntityEmptyForeignKeyAggregators({
      metadataName: "rowLevelPermissionPredicateGroup",
    });

  return {
    ...action,
    flatEntity: {
      ...action.flatEntity,
      objectMetadataId,
      roleId,
      parentRowLevelPermissionPredicateGroupId,
      applicationId: flatApplication.id,
      id: action.id ?? v4(),
      workspaceId,
      rowLevelPermissionPredicateIds: [],
      childRowLevelPermissionPredicateGroupIds: [],
      ...emptyUniversalForeignKeyAggregators,
    },
  };
};

export const createRowLevelPermissionPredicateGroupExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatCreateRowLevelPermissionPredicateGroupAction>,
): Promise<void> => {
  const { flatAction, queryRunner } = context;
  const { flatEntity } = flatAction;

  await WorkspaceMigrationRunnerActionHandler.insertFlatEntitiesInRepository({
    queryRunner,
    flatEntities: [flatEntity],
  });
};

export const createRowLevelPermissionPredicateGroupExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
