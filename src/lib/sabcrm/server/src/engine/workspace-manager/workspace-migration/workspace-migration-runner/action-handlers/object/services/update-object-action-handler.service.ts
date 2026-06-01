import "server-only";

import { isDefined } from "@/lib/sabcrm/shared/utils";

import { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import {
  FlatEntityMapsException,
  FlatEntityMapsExceptionCode,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/exceptions/flat-entity-maps.exception";
import { FlatEntityUpdate } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/flat-entity-update.type";
import { findFlatEntityByIdInFlatEntityMapsOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps-or-throw.util";
import { findFlatEntityByUniversalIdentifierOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util";
import { findFlatEntityByUniversalIdentifier } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier.util";
import {
  type FlatUpdateObjectAction,
  type UniversalUpdateObjectAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/object/types/workspace-migration-object-action";
import {
  type WorkspaceMigrationActionRunnerArgs,
  type WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// PORT-NOTE: WorkspaceSchemaManagerService, collectEnumOperationsForObject,
// executeBatchEnumOperations, computeObjectTargetTable, and findManyFlatEntityByIdInFlatEntityMapsOrThrow
// are Postgres-specific. executeForWorkspaceSchema is a no-op in Mongo — renaming an object
// does NOT rename a Mongo collection automatically; collection aliases must be maintained separately.

export class UpdateObjectActionHandlerService extends WorkspaceMigrationRunnerActionHandler(
  "update",
  "objectMetadata",
) {
  constructor() {
    super();
  }

  override async transpileUniversalActionToFlatAction(
    context: WorkspaceMigrationActionRunnerArgs<UniversalUpdateObjectAction>,
  ): Promise<FlatUpdateObjectAction> {
    const { action, allFlatEntityMaps } = context;

    const flatObjectMetadata = findFlatEntityByUniversalIdentifierOrThrow({
      flatEntityMaps: allFlatEntityMaps.flatObjectMetadataMaps,
      universalIdentifier: action.universalIdentifier,
    });

    // TODO remove once https://github.com/twentyhq/core-team-issues/issues/2172 has been resolved
    const {
      labelIdentifierFieldMetadataUniversalIdentifier,
      imageIdentifierFieldMetadataUniversalIdentifier,
      ...restUpdate
    } = action.update;

    const transpiledUpdate: FlatEntityUpdate<"objectMetadata"> = {
      ...restUpdate,
    };

    if (isDefined(labelIdentifierFieldMetadataUniversalIdentifier)) {
      const flatFieldMetadata = findFlatEntityByUniversalIdentifier({
        flatEntityMaps: allFlatEntityMaps.flatFieldMetadataMaps,
        universalIdentifier: labelIdentifierFieldMetadataUniversalIdentifier,
      });

      if (!isDefined(flatFieldMetadata)) {
        throw new FlatEntityMapsException(
          `Could not resolve labelIdentifierFieldMetadataUniversalIdentifier to labelIdentifierFieldMetadataId: no fieldMetadata found for universal identifier ${labelIdentifierFieldMetadataUniversalIdentifier}`,
          FlatEntityMapsExceptionCode.ENTITY_NOT_FOUND,
        );
      }

      transpiledUpdate.labelIdentifierFieldMetadataId = flatFieldMetadata.id;
    }

    if (isDefined(imageIdentifierFieldMetadataUniversalIdentifier)) {
      const flatFieldMetadata = findFlatEntityByUniversalIdentifier({
        flatEntityMaps: allFlatEntityMaps.flatFieldMetadataMaps,
        universalIdentifier: imageIdentifierFieldMetadataUniversalIdentifier,
      });

      if (!isDefined(flatFieldMetadata)) {
        throw new FlatEntityMapsException(
          `Could not resolve imageIdentifierFieldMetadataUniversalIdentifier to imageIdentifierFieldMetadataId: no fieldMetadata found for universal identifier ${imageIdentifierFieldMetadataUniversalIdentifier}`,
          FlatEntityMapsExceptionCode.ENTITY_NOT_FOUND,
        );
      }

      transpiledUpdate.imageIdentifierFieldMetadataId = flatFieldMetadata.id;
    }

    return {
      type: "update",
      metadataName: "objectMetadata",
      entityId: flatObjectMetadata.id,
      update: transpiledUpdate,
    };
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatUpdateObjectAction>,
  ): Promise<void> {
    const { flatAction, queryRunner } = context;

    void queryRunner; // PORT-NOTE: replaced by direct Mongo call
    const db = await (await import("@/lib/mongodb")).connectToDatabase();
    await db
      .collection("sabcrm_objectMetadata")
      .updateOne({ id: flatAction.entityId }, { $set: flatAction.update });
  }

  async executeForWorkspaceSchema(
    context: WorkspaceMigrationActionRunnerContext<FlatUpdateObjectAction>,
  ): Promise<void> {
    // PORT-NOTE: Postgres table rename (renameTable) and enum rename operations have no
    // Mongo DDL equivalent. In Mongo, objects are identified by their metadata id,
    // not by a collection name derived from nameSingular. This is intentionally a no-op.
    const {
      flatAction,
      allFlatEntityMaps: { flatObjectMetadataMaps },
    } = context;

    const _flatObjectMetadata = findFlatEntityByIdInFlatEntityMapsOrThrow({
      flatEntityMaps: flatObjectMetadataMaps,
      flatEntityId: flatAction.entityId,
    });

    void _flatObjectMetadata;
  }
}
