import "server-only";

import { findFlatEntityByUniversalIdentifierOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util";
import { resolveUniversalUpdateRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-update-relation-identifiers-to-ids.util";
import type {
  FlatUpdateViewFilterAction,
  UniversalUpdateViewFilterAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/view-filter/types/workspace-migration-view-filter-action.type";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// PORT-NOTE: NestJS @Injectable + TypeORM repository replaced with plain class + MongoDB collection.
export class UpdateViewFilterActionHandlerService {
  async transpileUniversalActionToFlatAction(
    context: WorkspaceMigrationActionRunnerArgs<UniversalUpdateViewFilterAction>,
  ): Promise<FlatUpdateViewFilterAction> {
    const { action, allFlatEntityMaps } = context;

    const flatViewFilter = findFlatEntityByUniversalIdentifierOrThrow({
      flatEntityMaps: allFlatEntityMaps.flatViewFilterMaps,
      universalIdentifier: action.universalIdentifier,
    });

    const update = resolveUniversalUpdateRelationIdentifiersToIds({
      metadataName: "viewFilter",
      universalUpdate: action.update,
      allFlatEntityMaps,
    });

    return {
      type: "update",
      metadataName: "viewFilter",
      entityId: flatViewFilter.id,
      update,
    };
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatUpdateViewFilterAction>,
  ): Promise<void> {
    const { flatAction, workspaceId, db } = context as WorkspaceMigrationActionRunnerContext<FlatUpdateViewFilterAction> & { db: import("mongodb").Db };
    const { entityId, update } = flatAction;

    await db
      .collection("sabcrm_view_filter")
      .updateOne({ id: entityId, workspaceId }, { $set: update });
  }

  async executeForWorkspaceSchema(
    _context: WorkspaceMigrationActionRunnerContext<FlatUpdateViewFilterAction>,
  ): Promise<void> {
    return;
  }
}
