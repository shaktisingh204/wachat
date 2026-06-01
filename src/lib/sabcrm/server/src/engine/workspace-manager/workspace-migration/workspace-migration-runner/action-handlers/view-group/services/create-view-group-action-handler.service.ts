import "server-only";

import { v4 } from "uuid";

import { getUniversalFlatEntityEmptyForeignKeyAggregators } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/reset-universal-flat-entity-foreign-key-aggregators.util";
import { resolveUniversalRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-relation-identifiers-to-ids.util";
import type {
  FlatCreateViewGroupAction,
  UniversalCreateViewGroupAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/view-group/types/workspace-migration-view-group-action.type";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// PORT-NOTE: NestJS @Injectable removed; plain class with Mongo collection.
export class CreateViewGroupActionHandlerService {
  async transpileUniversalActionToFlatAction({
    action,
    allFlatEntityMaps,
    flatApplication,
    workspaceId,
  }: WorkspaceMigrationActionRunnerArgs<UniversalCreateViewGroupAction>): Promise<FlatCreateViewGroupAction> {
    const { viewId } = resolveUniversalRelationIdentifiersToIds({
      flatEntityMaps: allFlatEntityMaps,
      metadataName: action.metadataName,
      universalForeignKeyValues: action.flatEntity,
    });

    const emptyUniversalForeignKeyAggregators =
      getUniversalFlatEntityEmptyForeignKeyAggregators({
        metadataName: "viewGroup",
      });

    return {
      ...action,
      flatEntity: {
        ...action.flatEntity,
        viewId,
        id: action.id ?? v4(),
        applicationId: flatApplication.id,
        workspaceId,
        ...emptyUniversalForeignKeyAggregators,
      },
    };
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatCreateViewGroupAction>,
  ): Promise<void> {
    const { flatAction, db } = context as WorkspaceMigrationActionRunnerContext<FlatCreateViewGroupAction> & { db: import("mongodb").Db };
    const { flatEntity } = flatAction;

    await db
      .collection("sabcrm_view_group")
      .insertOne({ ...flatEntity, _id: flatEntity.id as unknown as import("mongodb").ObjectId });
  }

  async executeForWorkspaceSchema(
    _context: WorkspaceMigrationActionRunnerContext<FlatCreateViewGroupAction>,
  ): Promise<void> {
    return;
  }
}
