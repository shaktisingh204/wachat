import "server-only";

import { v4 } from "uuid";

import type {
  FlatCreateViewSortAction,
  UniversalCreateViewSortAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/view-sort/types/workspace-migration-view-sort-action.type";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";
import { resolveUniversalRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-relation-identifiers-to-ids.util";

// PORT-NOTE: NestJS @Injectable removed; plain class with Mongo collection.
// viewSort has no empty foreign key aggregators in source (not called for this entity).
export class CreateViewSortActionHandlerService {
  async transpileUniversalActionToFlatAction({
    action,
    allFlatEntityMaps,
    flatApplication,
    workspaceId,
  }: WorkspaceMigrationActionRunnerArgs<UniversalCreateViewSortAction>): Promise<FlatCreateViewSortAction> {
    const { fieldMetadataId, viewId } =
      resolveUniversalRelationIdentifiersToIds({
        flatEntityMaps: allFlatEntityMaps,
        metadataName: action.metadataName,
        universalForeignKeyValues: action.flatEntity,
      });

    return {
      ...action,
      flatEntity: {
        ...action.flatEntity,
        fieldMetadataId,
        viewId,
        id: action.id ?? v4(),
        applicationId: flatApplication.id,
        workspaceId,
      },
    };
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatCreateViewSortAction>,
  ): Promise<void> {
    const { flatAction, db } = context as WorkspaceMigrationActionRunnerContext<FlatCreateViewSortAction> & { db: import("mongodb").Db };
    const { flatEntity } = flatAction;

    await db
      .collection("sabcrm_view_sort")
      .insertOne({ ...flatEntity, _id: flatEntity.id as unknown as import("mongodb").ObjectId });
  }

  async executeForWorkspaceSchema(
    _context: WorkspaceMigrationActionRunnerContext<FlatCreateViewSortAction>,
  ): Promise<void> {
    return;
  }
}
