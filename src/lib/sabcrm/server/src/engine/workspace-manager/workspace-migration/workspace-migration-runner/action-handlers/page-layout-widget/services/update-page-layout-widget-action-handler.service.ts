import "server-only";

import { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import { findFlatEntityByUniversalIdentifierOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util";
import { resolveUniversalUpdateRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-update-relation-identifiers-to-ids.util";
import {
  FlatUpdatePageLayoutWidgetAction,
  UniversalUpdatePageLayoutWidgetAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/page-layout-widget/types/workspace-migration-page-layout-widget-action.type";
import { fromUniversalConfigurationToFlatPageLayoutWidgetConfiguration } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/page-layout-widget/services/utils/from-universal-configuration-to-flat-page-layout-widget-configuration.util";
import { fromUniversalOverridesToPageLayoutWidgetOverrides } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/page-layout-widget/services/utils/from-universal-overrides-to-page-layout-widget-overrides.util";
import {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

export class UpdatePageLayoutWidgetActionHandlerService extends WorkspaceMigrationRunnerActionHandler(
  "update",
  "pageLayoutWidget",
) {
  constructor() {
    super();
  }

  override async transpileUniversalActionToFlatAction(
    context: WorkspaceMigrationActionRunnerArgs<UniversalUpdatePageLayoutWidgetAction>,
  ): Promise<FlatUpdatePageLayoutWidgetAction> {
    const { action, allFlatEntityMaps } = context;

    const flatPageLayoutWidget = findFlatEntityByUniversalIdentifierOrThrow({
      flatEntityMaps: allFlatEntityMaps.flatPageLayoutWidgetMaps,
      universalIdentifier: action.universalIdentifier,
    });

    const {
      universalConfiguration,
      universalOverrides,
      ...updateWithResolvedForeignKeys
    } = resolveUniversalUpdateRelationIdentifiersToIds({
      metadataName: "pageLayoutWidget",
      universalUpdate: action.update,
      allFlatEntityMaps,
    });

    const updateWithConfiguration =
      universalConfiguration === undefined
        ? updateWithResolvedForeignKeys
        : {
            ...updateWithResolvedForeignKeys,
            configuration:
              fromUniversalConfigurationToFlatPageLayoutWidgetConfiguration({
                universalConfiguration,
                flatFieldMetadataMaps: allFlatEntityMaps.flatFieldMetadataMaps,
                flatFrontComponentMaps:
                  allFlatEntityMaps.flatFrontComponentMaps,
                flatViewMaps: allFlatEntityMaps.flatViewMaps,
                flatViewFieldGroupMaps:
                  allFlatEntityMaps.flatViewFieldGroupMaps,
              }),
          };

    const update =
      universalOverrides === undefined
        ? updateWithConfiguration
        : universalOverrides === null
          ? { ...updateWithConfiguration, overrides: null }
          : {
              ...updateWithConfiguration,
              overrides: fromUniversalOverridesToPageLayoutWidgetOverrides({
                universalOverrides,
                flatPageLayoutTabMaps: allFlatEntityMaps.flatPageLayoutTabMaps,
              }),
            };

    return {
      type: "update",
      metadataName: "pageLayoutWidget",
      entityId: flatPageLayoutWidget.id,
      update,
    };
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatUpdatePageLayoutWidgetAction>,
  ): Promise<void> {
    const { flatAction, queryRunner, workspaceId } = context;
    const { entityId, update } = flatAction;

    void queryRunner; // PORT-NOTE: replaced by direct Mongo call
    const db = await (await import("@/lib/mongodb")).connectToDatabase();
    await db
      .collection("sabcrm_pageLayoutWidget")
      .updateOne({ id: entityId, workspaceId }, { $set: update });
  }

  async executeForWorkspaceSchema(
    _context: WorkspaceMigrationActionRunnerContext<FlatUpdatePageLayoutWidgetAction>,
  ): Promise<void> {
    return;
  }
}
