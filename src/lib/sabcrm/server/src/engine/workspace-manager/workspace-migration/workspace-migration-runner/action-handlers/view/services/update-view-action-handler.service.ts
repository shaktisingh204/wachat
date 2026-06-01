import "server-only";

import { findFlatEntityByUniversalIdentifierOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util";
import { resolveUniversalUpdateRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-update-relation-identifiers-to-ids.util";
import type {
  FlatUpdateViewAction,
  UniversalUpdateViewAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/view/types/workspace-migration-view-action.type";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// PORT-NOTE: NestJS @Injectable + TypeORM ViewEntity repository replaced with plain class + MongoDB collection sabcrm_view.
export class UpdateViewActionHandlerService {
  async transpileUniversalActionToFlatAction(
    context: WorkspaceMigrationActionRunnerArgs<UniversalUpdateViewAction>,
  ): Promise<FlatUpdateViewAction> {
    const { action, allFlatEntityMaps } = context;

    const flatView = findFlatEntityByUniversalIdentifierOrThrow({
      flatEntityMaps: allFlatEntityMaps.flatViewMaps,
      universalIdentifier: action.universalIdentifier,
    });

    const update = resolveUniversalUpdateRelationIdentifiersToIds({
      metadataName: "view",
      universalUpdate: action.update,
      allFlatEntityMaps,
    });

    return {
      type: "update",
      metadataName: "view",
      entityId: flatView.id,
      update,
    };
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatUpdateViewAction>,
  ): Promise<void> {
    const { flatAction, workspaceId, db } = context as WorkspaceMigrationActionRunnerContext<FlatUpdateViewAction> & { db: import("mongodb").Db };
    const { entityId, update } = flatAction;

    await db
      .collection("sabcrm_view")
      .updateOne({ id: entityId, workspaceId }, { $set: update });
  }

  async executeForWorkspaceSchema(
    _context: WorkspaceMigrationActionRunnerContext<FlatUpdateViewAction>,
  ): Promise<void> {
    return;
  }
}
