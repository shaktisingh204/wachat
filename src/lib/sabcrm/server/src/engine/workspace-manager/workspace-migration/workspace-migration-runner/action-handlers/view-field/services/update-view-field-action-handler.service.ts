import "server-only";

import { findFlatEntityByUniversalIdentifierOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util";
import { resolveUniversalUpdateRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-update-relation-identifiers-to-ids.util";
import type {
  FlatUpdateViewFieldAction,
  UniversalUpdateViewFieldAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/view-field/types/workspace-migration-view-field-action.type";
import { fromUniversalOverridesToViewFieldOverrides } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view-field/services/utils/from-universal-overrides-to-view-field-overrides.util";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// PORT-NOTE: NestJS @Injectable + TypeORM repository replaced with plain class + MongoDB collection.
export class UpdateViewFieldActionHandlerService {
  async transpileUniversalActionToFlatAction(
    context: WorkspaceMigrationActionRunnerArgs<UniversalUpdateViewFieldAction>,
  ): Promise<FlatUpdateViewFieldAction> {
    const { action, allFlatEntityMaps } = context;

    const flatViewField = findFlatEntityByUniversalIdentifierOrThrow({
      flatEntityMaps: allFlatEntityMaps.flatViewFieldMaps,
      universalIdentifier: action.universalIdentifier,
    });

    const { universalOverrides, ...updateWithResolvedForeignKeys } =
      resolveUniversalUpdateRelationIdentifiersToIds({
        metadataName: "viewField",
        universalUpdate: action.update,
        allFlatEntityMaps,
      });

    const update =
      universalOverrides === undefined
        ? updateWithResolvedForeignKeys
        : universalOverrides === null
          ? { ...updateWithResolvedForeignKeys, overrides: null }
          : {
              ...updateWithResolvedForeignKeys,
              overrides: fromUniversalOverridesToViewFieldOverrides({
                universalOverrides,
                flatViewFieldGroupMaps:
                  allFlatEntityMaps.flatViewFieldGroupMaps,
              }),
            };

    return {
      type: "update",
      metadataName: "viewField",
      entityId: flatViewField.id,
      update,
    };
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatUpdateViewFieldAction>,
  ): Promise<void> {
    const { flatAction, workspaceId, db } = context as WorkspaceMigrationActionRunnerContext<FlatUpdateViewFieldAction> & { db: import("mongodb").Db };
    const { entityId, update } = flatAction;

    await db
      .collection("sabcrm_view_field")
      .updateOne({ id: entityId, workspaceId }, { $set: update });
  }

  async executeForWorkspaceSchema(
    _context: WorkspaceMigrationActionRunnerContext<FlatUpdateViewFieldAction>,
  ): Promise<void> {
    return;
  }
}
