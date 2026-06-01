import "server-only";

import type {
  FlatUpdateViewSortAction,
  UniversalUpdateViewSortAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/view-sort/types/workspace-migration-view-sort-action.type";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";
import { findFlatEntityByUniversalIdentifierOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util";
import { resolveUniversalUpdateRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-update-relation-identifiers-to-ids.util";

// PORT-NOTE: NestJS @Injectable + TypeORM repository replaced with plain class + MongoDB collection.
export class UpdateViewSortActionHandlerService {
  async transpileUniversalActionToFlatAction(
    context: WorkspaceMigrationActionRunnerArgs<UniversalUpdateViewSortAction>,
  ): Promise<FlatUpdateViewSortAction> {
    const { action, allFlatEntityMaps } = context;

    const flatViewSort = findFlatEntityByUniversalIdentifierOrThrow({
      flatEntityMaps: allFlatEntityMaps.flatViewSortMaps,
      universalIdentifier: action.universalIdentifier,
    });

    const update = resolveUniversalUpdateRelationIdentifiersToIds({
      metadataName: "viewSort",
      universalUpdate: action.update,
      allFlatEntityMaps,
    });

    return {
      type: "update",
      metadataName: "viewSort",
      entityId: flatViewSort.id,
      update,
    };
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatUpdateViewSortAction>,
  ): Promise<void> {
    const { flatAction, workspaceId, db } = context as WorkspaceMigrationActionRunnerContext<FlatUpdateViewSortAction> & { db: import("mongodb").Db };
    const { entityId, update } = flatAction;

    await db
      .collection("sabcrm_view_sort")
      .updateOne({ id: entityId, workspaceId }, { $set: update });
  }

  async executeForWorkspaceSchema(
    _context: WorkspaceMigrationActionRunnerContext<FlatUpdateViewSortAction>,
  ): Promise<void> {
    return;
  }
}
