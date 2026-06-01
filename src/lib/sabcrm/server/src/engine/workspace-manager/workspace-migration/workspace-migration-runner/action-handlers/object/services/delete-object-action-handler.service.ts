import "server-only";

import { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import { findFlatEntityByIdInFlatEntityMapsOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps-or-throw.util";
import { findFlatEntityByUniversalIdentifierOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util";
import {
  type FlatDeleteObjectAction,
  type UniversalDeleteObjectAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/object/types/workspace-migration-object-action";
import {
  type WorkspaceMigrationActionRunnerArgs,
  type WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// PORT-NOTE: WorkspaceSchemaManagerService, collectEnumOperationsForObject,
// executeBatchEnumOperations, and findManyFlatEntityByIdInFlatEntityMapsOrThrow
// are Postgres-specific. Schema-level drop table has no Mongo equivalent.

export class DeleteObjectActionHandlerService extends WorkspaceMigrationRunnerActionHandler(
  "delete",
  "objectMetadata",
) {
  constructor() {
    super();
  }

  override async transpileUniversalActionToFlatAction(
    context: WorkspaceMigrationActionRunnerArgs<UniversalDeleteObjectAction>,
  ): Promise<FlatDeleteObjectAction> {
    const { action, allFlatEntityMaps } = context;

    const flatObjectMetadata = findFlatEntityByUniversalIdentifierOrThrow({
      flatEntityMaps: allFlatEntityMaps.flatObjectMetadataMaps,
      universalIdentifier: action.universalIdentifier,
    });

    return {
      type: "delete",
      metadataName: "objectMetadata",
      entityId: flatObjectMetadata.id,
    };
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatDeleteObjectAction>,
  ): Promise<void> {
    const { flatAction, queryRunner } = context;

    void queryRunner; // PORT-NOTE: replaced by direct Mongo call
    const db = await (await import("@/lib/mongodb")).connectToDatabase();
    await db
      .collection("sabcrm_objectMetadata")
      .deleteOne({ id: flatAction.entityId });
  }

  async executeForWorkspaceSchema(
    context: WorkspaceMigrationActionRunnerContext<FlatDeleteObjectAction>,
  ): Promise<void> {
    // PORT-NOTE: Postgres schema DROP TABLE has no Mongo equivalent.
    // MongoDB collections are not dropped on object metadata delete; data cleanup
    // must be handled separately if needed.
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
