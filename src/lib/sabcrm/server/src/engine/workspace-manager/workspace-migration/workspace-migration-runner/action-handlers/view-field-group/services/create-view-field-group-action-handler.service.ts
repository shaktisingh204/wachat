import "server-only";

import { v4 } from "uuid";

import { connectToDatabase } from "@/lib/mongodb";
import { getUniversalFlatEntityEmptyForeignKeyAggregators } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/reset-universal-flat-entity-foreign-key-aggregators.util";
import { resolveUniversalRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-relation-identifiers-to-ids.util";
import type {
  FlatCreateViewFieldGroupAction,
  UniversalCreateViewFieldGroupAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/view-field-group/types/workspace-migration-view-field-group-action.type";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS CreateViewFieldGroupActionHandlerService — drops @Injectable DI.
// executeForMetadata uses Mongo insertOne instead of TypeORM repository.insert.

export const createViewFieldGroupTranspile = async ({
  action,
  allFlatEntityMaps,
  flatApplication,
  workspaceId,
}: WorkspaceMigrationActionRunnerArgs<UniversalCreateViewFieldGroupAction>): Promise<FlatCreateViewFieldGroupAction> => {
  const { viewId } = resolveUniversalRelationIdentifiersToIds({
    flatEntityMaps: allFlatEntityMaps,
    metadataName: action.metadataName,
    universalForeignKeyValues: action.flatEntity,
  });

  const emptyUniversalForeignKeyAggregators =
    getUniversalFlatEntityEmptyForeignKeyAggregators({
      metadataName: "viewFieldGroup",
    });

  return {
    ...action,
    flatEntity: {
      ...action.flatEntity,
      viewId,
      id: action.id ?? v4(),
      applicationId: flatApplication.id,
      workspaceId,
      viewFieldIds: [],
      ...emptyUniversalForeignKeyAggregators,
    },
  };
};

export const createViewFieldGroupExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatCreateViewFieldGroupAction>,
): Promise<void> => {
  const { flatAction } = context;
  const { flatEntity } = flatAction;

  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_view_field_group");

  await collection.insertOne({ ...flatEntity });
};

export const createViewFieldGroupExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
