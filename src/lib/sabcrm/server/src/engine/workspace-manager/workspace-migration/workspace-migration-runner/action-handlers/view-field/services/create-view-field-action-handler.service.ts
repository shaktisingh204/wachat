import "server-only";

import { v4 } from "uuid";
import { isDefined } from "@/lib/sabcrm/shared/utils/is-defined.util";

import type { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import { getUniversalFlatEntityEmptyForeignKeyAggregators } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/reset-universal-flat-entity-foreign-key-aggregators.util";
import { resolveUniversalRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-relation-identifiers-to-ids.util";
import type {
  FlatCreateViewFieldAction,
  UniversalCreateViewFieldAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/view-field/types/workspace-migration-view-field-action.type";
import { fromUniversalOverridesToViewFieldOverrides } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/view-field/services/utils/from-universal-overrides-to-view-field-overrides.util";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// PORT-NOTE: NestJS @Injectable class mixin removed. Ported as a plain class implementing the same interface.
// In Next.js there is no DI container — instantiate directly or via a factory.
export class CreateViewFieldActionHandlerService {
  async transpileUniversalActionToFlatAction({
    action,
    allFlatEntityMaps,
    flatApplication,
    workspaceId,
  }: WorkspaceMigrationActionRunnerArgs<UniversalCreateViewFieldAction>): Promise<FlatCreateViewFieldAction> {
    const { fieldMetadataId, viewId, viewFieldGroupId } =
      resolveUniversalRelationIdentifiersToIds({
        flatEntityMaps: allFlatEntityMaps,
        metadataName: action.metadataName,
        universalForeignKeyValues: action.flatEntity,
      });

    const overrides = isDefined(action.flatEntity.universalOverrides)
      ? fromUniversalOverridesToViewFieldOverrides({
          universalOverrides: action.flatEntity.universalOverrides,
          flatViewFieldGroupMaps: allFlatEntityMaps.flatViewFieldGroupMaps,
        })
      : null;

    const emptyUniversalForeignKeyAggregators =
      getUniversalFlatEntityEmptyForeignKeyAggregators({
        metadataName: "viewField",
      });

    return {
      ...action,
      flatEntity: {
        ...action.flatEntity,
        fieldMetadataId,
        viewId,
        viewFieldGroupId,
        overrides,
        id: action.id ?? v4(),
        applicationId: flatApplication.id,
        workspaceId,
        ...emptyUniversalForeignKeyAggregators,
      },
    };
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatCreateViewFieldAction>,
  ): Promise<void> {
    const { flatAction, db } = context as WorkspaceMigrationActionRunnerContext<FlatCreateViewFieldAction> & { db: import("mongodb").Db };
    const { flatEntity } = flatAction;

    // PORT-NOTE: TypeORM queryRunner replaced with Mongo collection insert.
    await db
      .collection("sabcrm_view_field")
      .insertOne({ ...flatEntity, _id: flatEntity.id as unknown as import("mongodb").ObjectId });
  }

  async executeForWorkspaceSchema(
    _context: WorkspaceMigrationActionRunnerContext<FlatCreateViewFieldAction>,
  ): Promise<void> {
    return;
  }
}
