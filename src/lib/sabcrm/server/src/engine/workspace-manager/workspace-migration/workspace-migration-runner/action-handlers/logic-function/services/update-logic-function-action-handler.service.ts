import "server-only";

import { FileFolder } from "@/lib/sabcrm/shared/types";
import { isDefined } from "@/lib/sabcrm/shared/utils";

import { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import { FileStorageService } from "@/lib/sabcrm/server/src/engine/core-modules/file-storage/file-storage.service";
import { findFlatEntityByIdInFlatEntityMapsOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps-or-throw.util";
import { findFlatEntityByUniversalIdentifierOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util";
import { resolveUniversalUpdateRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-update-relation-identifiers-to-ids.util";
import {
  FlatUpdateLogicFunctionAction,
  UniversalUpdateLogicFunctionAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/logic-function/types/workspace-migration-logic-function-action.type";
import {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

export class UpdateLogicFunctionActionHandlerService extends WorkspaceMigrationRunnerActionHandler(
  "update",
  "logicFunction",
) {
  constructor(private readonly fileStorageService: FileStorageService) {
    super();
  }

  override async transpileUniversalActionToFlatAction(
    context: WorkspaceMigrationActionRunnerArgs<UniversalUpdateLogicFunctionAction>,
  ): Promise<FlatUpdateLogicFunctionAction> {
    const { action, allFlatEntityMaps } = context;

    const flatLogicFunction = findFlatEntityByUniversalIdentifierOrThrow({
      flatEntityMaps: allFlatEntityMaps.flatLogicFunctionMaps,
      universalIdentifier: action.universalIdentifier,
    });

    const update = resolveUniversalUpdateRelationIdentifiersToIds({
      metadataName: "logicFunction",
      universalUpdate: action.update,
      allFlatEntityMaps,
    });

    return {
      type: "update",
      metadataName: "logicFunction",
      entityId: flatLogicFunction.id,
      update,
    };
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatUpdateLogicFunctionAction>,
  ): Promise<void> {
    const {
      flatAction,
      queryRunner,
      workspaceId,
      allFlatEntityMaps,
      flatApplication,
    } = context;
    const { entityId, update } = flatAction;

    const existingLogicFunction = findFlatEntityByIdInFlatEntityMapsOrThrow({
      flatEntityMaps: allFlatEntityMaps.flatLogicFunctionMaps,
      flatEntityId: entityId,
    });

    const applicationUniversalIdentifier = flatApplication.universalIdentifier;

    const builtPathChanged =
      isDefined(update.builtHandlerPath) &&
      update.builtHandlerPath !== existingLogicFunction.builtHandlerPath;

    // PORT-NOTE: In Mongo, update the sabcrm_logicFunction collection.
    void queryRunner; // kept for interface compatibility
    const db = await (await import("@/lib/mongodb")).connectToDatabase();
    await db
      .collection("sabcrm_logicFunction")
      .updateOne({ id: entityId, workspaceId }, { $set: update });

    if (builtPathChanged) {
      await this.fileStorageService.deleteFile({
        workspaceId,
        applicationUniversalIdentifier,
        fileFolder: FileFolder.BuiltLogicFunction,
        resourcePath: existingLogicFunction.builtHandlerPath,
      });
    }
  }
}
