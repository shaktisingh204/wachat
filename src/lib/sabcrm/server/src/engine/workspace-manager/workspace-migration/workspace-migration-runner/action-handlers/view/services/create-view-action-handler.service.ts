import "server-only";

import { v4 } from "uuid";

import { getUniversalFlatEntityEmptyForeignKeyAggregators } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/reset-universal-flat-entity-foreign-key-aggregators.util";
import { resolveUniversalRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-relation-identifiers-to-ids.util";
import type {
  FlatCreateViewAction,
  UniversalCreateViewAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/view/types/workspace-migration-view-action.type";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// PORT-NOTE: NestJS @Injectable removed; plain class with Mongo collection.
export class CreateViewActionHandlerService {
  async transpileUniversalActionToFlatAction({
    action,
    allFlatEntityMaps,
    flatApplication,
    workspaceId,
  }: WorkspaceMigrationActionRunnerArgs<UniversalCreateViewAction>): Promise<FlatCreateViewAction> {
    const {
      calendarFieldMetadataId,
      kanbanAggregateOperationFieldMetadataId,
      mainGroupByFieldMetadataId,
      objectMetadataId,
    } = resolveUniversalRelationIdentifiersToIds({
      flatEntityMaps: allFlatEntityMaps,
      metadataName: action.metadataName,
      universalForeignKeyValues: action.flatEntity,
    });

    const emptyUniversalForeignKeyAggregators =
      getUniversalFlatEntityEmptyForeignKeyAggregators({
        metadataName: "view",
      });

    return {
      ...action,
      flatEntity: {
        ...action.flatEntity,
        calendarFieldMetadataId,
        kanbanAggregateOperationFieldMetadataId,
        mainGroupByFieldMetadataId,
        objectMetadataId,
        id: action.id ?? v4(),
        applicationId: flatApplication.id,
        workspaceId,
        viewFieldIds: [],
        viewFieldGroupIds: [],
        viewGroupIds: [],
        viewFilterIds: [],
        viewFilterGroupIds: [],
        viewSortIds: [],
        ...emptyUniversalForeignKeyAggregators,
      },
    };
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatCreateViewAction>,
  ): Promise<void> {
    const { flatAction, db } = context as WorkspaceMigrationActionRunnerContext<FlatCreateViewAction> & { db: import("mongodb").Db };
    const { flatEntity } = flatAction;

    await db
      .collection("sabcrm_view")
      .insertOne({ ...flatEntity, _id: flatEntity.id as unknown as import("mongodb").ObjectId });
  }

  async executeForWorkspaceSchema(
    _context: WorkspaceMigrationActionRunnerContext<FlatCreateViewAction>,
  ): Promise<void> {
    return;
  }
}
