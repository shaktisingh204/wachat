import "server-only";

import { isDefined } from "@/lib/sabcrm/shared/utils";
import { v4 } from "uuid";

import { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import { getUniversalFlatEntityEmptyForeignKeyAggregators } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/reset-universal-flat-entity-foreign-key-aggregators.util";
import { resolveUniversalRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-relation-identifiers-to-ids.util";
import {
  FlatCreatePageLayoutWidgetAction,
  UniversalCreatePageLayoutWidgetAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/page-layout-widget/types/workspace-migration-page-layout-widget-action.type";
import { fromUniversalConfigurationToFlatPageLayoutWidgetConfiguration } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/page-layout-widget/services/utils/from-universal-configuration-to-flat-page-layout-widget-configuration.util";
import { fromUniversalOverridesToPageLayoutWidgetOverrides } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/page-layout-widget/services/utils/from-universal-overrides-to-page-layout-widget-overrides.util";
import {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

export class CreatePageLayoutWidgetActionHandlerService extends WorkspaceMigrationRunnerActionHandler(
  "create",
  "pageLayoutWidget",
) {
  constructor() {
    super();
  }

  override async transpileUniversalActionToFlatAction({
    action,
    allFlatEntityMaps,
    flatApplication,
    workspaceId,
  }: WorkspaceMigrationActionRunnerArgs<UniversalCreatePageLayoutWidgetAction>): Promise<FlatCreatePageLayoutWidgetAction> {
    const { pageLayoutTabId, objectMetadataId } =
      resolveUniversalRelationIdentifiersToIds({
        flatEntityMaps: allFlatEntityMaps,
        metadataName: action.metadataName,
        universalForeignKeyValues: action.flatEntity,
      });

    const configuration =
      fromUniversalConfigurationToFlatPageLayoutWidgetConfiguration({
        universalConfiguration: action.flatEntity.universalConfiguration,
        flatFieldMetadataMaps: allFlatEntityMaps.flatFieldMetadataMaps,
        flatFrontComponentMaps: allFlatEntityMaps.flatFrontComponentMaps,
        flatViewMaps: allFlatEntityMaps.flatViewMaps,
        flatViewFieldGroupMaps: allFlatEntityMaps.flatViewFieldGroupMaps,
      });

    const overrides = isDefined(action.flatEntity.universalOverrides)
      ? fromUniversalOverridesToPageLayoutWidgetOverrides({
          universalOverrides: action.flatEntity.universalOverrides,
          flatPageLayoutTabMaps: allFlatEntityMaps.flatPageLayoutTabMaps,
        })
      : null;

    const emptyUniversalForeignKeyAggregators =
      getUniversalFlatEntityEmptyForeignKeyAggregators({
        metadataName: "pageLayoutWidget",
      });

    return {
      ...action,
      flatEntity: {
        ...action.flatEntity,
        configuration,
        overrides,
        pageLayoutTabId,
        objectMetadataId,
        applicationId: flatApplication.id,
        id: action.id ?? v4(),
        workspaceId,
        ...emptyUniversalForeignKeyAggregators,
      },
    };
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatCreatePageLayoutWidgetAction>,
  ): Promise<void> {
    const { flatAction, queryRunner } = context;
    const { flatEntity } = flatAction;

    await this.insertFlatEntitiesInRepository({
      queryRunner,
      flatEntities: [flatEntity],
    });
  }

  async executeForWorkspaceSchema(
    _context: WorkspaceMigrationActionRunnerContext<FlatCreatePageLayoutWidgetAction>,
  ): Promise<void> {
    return;
  }
}
