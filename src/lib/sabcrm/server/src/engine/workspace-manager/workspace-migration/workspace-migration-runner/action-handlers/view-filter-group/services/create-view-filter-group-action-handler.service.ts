import "server-only";

import { v4 } from "uuid";

import { getUniversalFlatEntityEmptyForeignKeyAggregators } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/reset-universal-flat-entity-foreign-key-aggregators.util";
import { resolveUniversalRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-relation-identifiers-to-ids.util";
import type {
  FlatCreateViewFilterGroupAction,
  UniversalCreateViewFilterGroupAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/view-filter-group/types/workspace-migration-view-filter-group-action.type";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// PORT-NOTE: NestJS @Injectable removed; plain class with Mongo collection.
export class CreateViewFilterGroupActionHandlerService {
  async transpileUniversalActionToFlatAction({
    action,
    allFlatEntityMaps,
    flatApplication,
    workspaceId,
  }: WorkspaceMigrationActionRunnerArgs<UniversalCreateViewFilterGroupAction>): Promise<FlatCreateViewFilterGroupAction> {
    const { parentViewFilterGroupId, viewId } =
      resolveUniversalRelationIdentifiersToIds({
        flatEntityMaps: allFlatEntityMaps,
        metadataName: action.metadataName,
        universalForeignKeyValues: action.flatEntity,
      });

    const emptyUniversalForeignKeyAggregators =
      getUniversalFlatEntityEmptyForeignKeyAggregators({
        metadataName: "viewFilterGroup",
      });

    return {
      ...action,
      flatEntity: {
        ...action.flatEntity,
        parentViewFilterGroupId,
        viewId,
        id: action.id ?? v4(),
        applicationId: flatApplication.id,
        workspaceId,
        childViewFilterGroupIds: [],
        viewFilterIds: [],
        ...emptyUniversalForeignKeyAggregators,
      },
    };
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatCreateViewFilterGroupAction>,
  ): Promise<void> {
    const { flatAction, db } = context as WorkspaceMigrationActionRunnerContext<FlatCreateViewFilterGroupAction> & { db: import("mongodb").Db };
    const { flatEntity } = flatAction;

    await db
      .collection("sabcrm_view_filter_group")
      .insertOne({ ...flatEntity, _id: flatEntity.id as unknown as import("mongodb").ObjectId });
  }

  async executeForWorkspaceSchema(
    _context: WorkspaceMigrationActionRunnerContext<FlatCreateViewFilterGroupAction>,
  ): Promise<void> {
    return;
  }
}
