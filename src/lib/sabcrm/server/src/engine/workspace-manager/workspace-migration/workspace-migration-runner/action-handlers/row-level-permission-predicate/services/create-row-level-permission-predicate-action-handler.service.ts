// @license Enterprise

import "server-only";

import { v4 } from "uuid";

import { getUniversalFlatEntityEmptyForeignKeyAggregators } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/reset-universal-flat-entity-foreign-key-aggregators.util";
import { resolveUniversalRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-relation-identifiers-to-ids.util";
import type {
  FlatCreateRowLevelPermissionPredicateAction,
  UniversalCreateRowLevelPermissionPredicateAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/row-level-permission-predicate/types/workspace-migration-row-level-permission-predicate-action.type";
import { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS CreateRowLevelPermissionPredicateActionHandlerService — drops @Injectable DI.

export const createRowLevelPermissionPredicateTranspile = async ({
  action,
  allFlatEntityMaps,
  flatApplication,
  workspaceId,
}: WorkspaceMigrationActionRunnerArgs<UniversalCreateRowLevelPermissionPredicateAction>): Promise<FlatCreateRowLevelPermissionPredicateAction> => {
  const {
    roleId,
    fieldMetadataId,
    workspaceMemberFieldMetadataId,
    objectMetadataId,
    rowLevelPermissionPredicateGroupId,
  } = resolveUniversalRelationIdentifiersToIds({
    flatEntityMaps: allFlatEntityMaps,
    metadataName: action.metadataName,
    universalForeignKeyValues: action.flatEntity,
  });

  const emptyUniversalForeignKeyAggregators =
    getUniversalFlatEntityEmptyForeignKeyAggregators({
      metadataName: "rowLevelPermissionPredicate",
    });

  return {
    ...action,
    flatEntity: {
      ...action.flatEntity,
      roleId,
      fieldMetadataId,
      workspaceMemberFieldMetadataId,
      objectMetadataId,
      rowLevelPermissionPredicateGroupId,
      applicationId: flatApplication.id,
      id: action.id ?? v4(),
      workspaceId,
      ...emptyUniversalForeignKeyAggregators,
    },
  };
};

export const createRowLevelPermissionPredicateExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatCreateRowLevelPermissionPredicateAction>,
): Promise<void> => {
  const { flatAction, queryRunner } = context;
  const { flatEntity } = flatAction;

  await WorkspaceMigrationRunnerActionHandler.insertFlatEntitiesInRepository({
    queryRunner,
    flatEntities: [flatEntity],
  });
};

export const createRowLevelPermissionPredicateExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
