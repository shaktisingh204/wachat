import "server-only";

import { v4 } from "uuid";

import { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import { getUniversalFlatEntityEmptyForeignKeyAggregators } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/reset-universal-flat-entity-foreign-key-aggregators.util";
import {
  FlatCreateLogicFunctionAction,
  UniversalCreateLogicFunctionAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/logic-function/types/workspace-migration-logic-function-action.type";
import {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

export class CreateLogicFunctionActionHandlerService extends WorkspaceMigrationRunnerActionHandler(
  "create",
  "logicFunction",
) {
  override async transpileUniversalActionToFlatAction({
    action,
    flatApplication,
    workspaceId,
  }: WorkspaceMigrationActionRunnerArgs<UniversalCreateLogicFunctionAction>): Promise<FlatCreateLogicFunctionAction> {
    const emptyUniversalForeignKeyAggregators =
      getUniversalFlatEntityEmptyForeignKeyAggregators({
        metadataName: "logicFunction",
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
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatCreateLogicFunctionAction>,
  ): Promise<void> {
    const { flatAction, queryRunner } = context;
    const { flatEntity: logicFunction } = flatAction;

    await this.insertFlatEntitiesInRepository({
      queryRunner,
      flatEntities: [logicFunction],
    });
  }

  async rollbackForMetadata(
    _context: Omit<
      WorkspaceMigrationActionRunnerArgs<FlatCreateLogicFunctionAction>,
      "queryRunner"
    >,
  ): Promise<void> {
    // Nothing to rollback for now
    return;
  }
}
