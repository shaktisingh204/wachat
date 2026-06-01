import "server-only";

import { FileFolder } from "@/lib/sabcrm/shared/types";

import { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import { FileStorageService } from "@/lib/sabcrm/server/src/engine/core-modules/file-storage/file-storage.service";
import { findFlatEntityByIdInFlatEntityMapsOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps-or-throw.util";
import {
  FlatDeleteLogicFunctionAction,
  UniversalDeleteLogicFunctionAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/logic-function/types/workspace-migration-logic-function-action.type";
import {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";
import { getLogicFunctionSubfolderForFromSource } from "@/lib/sabcrm/server/src/engine/metadata-modules/logic-function/utils/get-logic-function-subfolder-for-from-source";

export class DeleteLogicFunctionActionHandlerService extends WorkspaceMigrationRunnerActionHandler(
  "delete",
  "logicFunction",
) {
  constructor(private readonly fileStorageService: FileStorageService) {
    super();
  }

  override async transpileUniversalActionToFlatAction(
    context: WorkspaceMigrationActionRunnerArgs<UniversalDeleteLogicFunctionAction>,
  ): Promise<FlatDeleteLogicFunctionAction> {
    return this.transpileUniversalDeleteActionToFlatDeleteAction(context);
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatDeleteLogicFunctionAction>,
  ): Promise<void> {
    const {
      flatAction,
      queryRunner,
      workspaceId,
      allFlatEntityMaps,
      flatApplication,
    } = context;

    const flatLogicFunction = findFlatEntityByIdInFlatEntityMapsOrThrow({
      flatEntityMaps: allFlatEntityMaps.flatLogicFunctionMaps,
      flatEntityId: flatAction.entityId,
    });

    // PORT-NOTE: In Mongo, delete from the sabcrm_logicFunction collection.
    // The queryRunner here is a compatibility shim — use the Mongo collection directly.
    const db = await (await import("@/lib/mongodb")).connectToDatabase();
    await db
      .collection("sabcrm_logicFunction")
      .deleteOne({ id: flatAction.entityId, workspaceId });

    void queryRunner; // kept for interface compatibility

    const applicationUniversalIdentifier = flatApplication.universalIdentifier;

    await this.fileStorageService.deleteFolder({
      workspaceId,
      applicationUniversalIdentifier,
      fileFolder: FileFolder.Source,
      folderPath: getLogicFunctionSubfolderForFromSource(flatLogicFunction.id),
    });

    await this.fileStorageService.deleteFile({
      workspaceId,
      applicationUniversalIdentifier,
      fileFolder: FileFolder.BuiltLogicFunction,
      resourcePath: flatLogicFunction.builtHandlerPath,
    });
  }

  async rollbackForMetadata(): Promise<void> {}
}
