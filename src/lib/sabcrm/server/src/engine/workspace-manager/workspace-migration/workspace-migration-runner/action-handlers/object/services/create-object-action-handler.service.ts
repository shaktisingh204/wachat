import "server-only";

import { v4 } from "uuid";

import { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import { isCompositeFlatFieldMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/utils/is-composite-flat-field-metadata.util";
import { isEnumFlatFieldMetadata } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/utils/is-enum-flat-field-metadata.util";
import {
  FlatCreateObjectAction,
  UniversalCreateObjectAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/object/types/workspace-migration-object-action";
import { fromUniversalFlatFieldMetadataToFlatFieldMetadata } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/field/services/utils/from-universal-flat-field-metadata-to-flat-field-metadata.util";
import { fromUniversalFlatObjectMetadataToFlatObjectMetadata } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/object/services/utils/from-universal-flat-object-metadata-to-flat-object-metadata.util";
import {
  type WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// PORT-NOTE: WorkspaceSchemaManagerService is a Postgres DDL abstraction; schema-level
// table creation is replaced here with Mongo collection creation (implicit on first insert).
// Enum DDL operations (collectEnumOperationsForObject / executeBatchEnumOperations) and
// generateColumnDefinitions / flatEntityToScalarFlatEntity have no Mongo equivalents and
// are omitted — field data is stored as-is in the document.

export class CreateObjectActionHandlerService extends WorkspaceMigrationRunnerActionHandler(
  "create",
  "objectMetadata",
) {
  constructor() {
    super();
  }

  override async transpileUniversalActionToFlatAction(
    context: WorkspaceMigrationActionRunnerArgs<UniversalCreateObjectAction>,
  ): Promise<FlatCreateObjectAction> {
    const { action, allFlatEntityMaps } = context;
    const { fieldIdByUniversalIdentifier, id: providedObjectId } = action;

    const allFieldIdToBeCreatedInActionByUniversalIdentifierMap = new Map<
      string,
      string
    >();

    for (const universalFlatFieldMetadata of action.universalFlatFieldMetadatas) {
      const providedFieldId =
        fieldIdByUniversalIdentifier?.[
          universalFlatFieldMetadata.universalIdentifier
        ];

      allFieldIdToBeCreatedInActionByUniversalIdentifierMap.set(
        universalFlatFieldMetadata.universalIdentifier,
        providedFieldId ?? v4(),
      );
    }

    const flatObjectMetadata =
      fromUniversalFlatObjectMetadataToFlatObjectMetadata({
        allFieldIdToBeCreatedInActionByUniversalIdentifierMap,
        allFlatEntityMaps,
        context,
        generatedId: providedObjectId ?? v4(),
        universalFlatObjectMetadata: action.flatEntity,
      });

    const flatFieldMetadatas = action.universalFlatFieldMetadatas.map(
      (universalFlatFieldMetadata) =>
        fromUniversalFlatFieldMetadataToFlatFieldMetadata({
          objectMetadataId: flatObjectMetadata.id,
          universalFlatFieldMetadata,
          allFieldIdToBeCreatedInActionByUniversalIdentifierMap,
          allFlatEntityMaps,
          context,
        }),
    );

    return {
      type: action.type,
      metadataName: action.metadataName,
      flatEntity: flatObjectMetadata,
      flatFieldMetadatas,
    };
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatCreateObjectAction>,
  ): Promise<void> {
    const { queryRunner, flatAction } = context;
    const { flatEntity: flatObjectMetadata, flatFieldMetadatas } = flatAction;

    await this.insertFlatEntitiesInRepository({
      queryRunner,
      flatEntities: [flatObjectMetadata],
    });

    // PORT-NOTE: In Mongo, field metadata documents are inserted into sabcrm_fieldMetadata.
    void isCompositeFlatFieldMetadata; // referenced for consistency but not needed for Mongo insert
    void isEnumFlatFieldMetadata;
    const db = await (await import("@/lib/mongodb")).connectToDatabase();
    if (flatFieldMetadatas.length > 0) {
      await db.collection("sabcrm_fieldMetadata").insertMany(flatFieldMetadatas);
    }
  }

  async executeForWorkspaceSchema(
    context: WorkspaceMigrationActionRunnerContext<FlatCreateObjectAction>,
  ): Promise<void> {
    // PORT-NOTE: Postgres schema table creation has no Mongo equivalent.
    // MongoDB creates collections implicitly on first insert (done in executeForMetadata).
    void context;
  }
}
