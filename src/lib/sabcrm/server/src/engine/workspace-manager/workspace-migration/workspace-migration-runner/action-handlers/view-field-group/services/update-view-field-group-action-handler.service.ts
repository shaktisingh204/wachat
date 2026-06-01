import "server-only";

import type { Collection } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { findFlatEntityByUniversalIdentifierOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util";
import { resolveUniversalUpdateRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-update-relation-identifiers-to-ids.util";
import type {
  FlatUpdateViewFieldGroupAction,
  UniversalUpdateViewFieldGroupAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/view-field-group/types/workspace-migration-view-field-group-action.type";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS UpdateViewFieldGroupActionHandlerService — drops @Injectable DI,
// replaces TypeORM repository.update with Mongo updateOne on sabcrm_view_field_group.

export const updateViewFieldGroupTranspile = async (
  context: WorkspaceMigrationActionRunnerArgs<UniversalUpdateViewFieldGroupAction>,
): Promise<FlatUpdateViewFieldGroupAction> => {
  const { action, allFlatEntityMaps } = context;

  const flatViewFieldGroup = findFlatEntityByUniversalIdentifierOrThrow({
    flatEntityMaps: allFlatEntityMaps.flatViewFieldGroupMaps,
    universalIdentifier: action.universalIdentifier,
  });

  const update = resolveUniversalUpdateRelationIdentifiersToIds({
    metadataName: "viewFieldGroup",
    universalUpdate: action.update,
    allFlatEntityMaps,
  });

  return {
    type: "update",
    metadataName: "viewFieldGroup",
    entityId: flatViewFieldGroup.id,
    update,
  };
};

export const updateViewFieldGroupExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatUpdateViewFieldGroupAction>,
): Promise<void> => {
  const { flatAction, workspaceId } = context;
  const { entityId, update } = flatAction;

  const { db } = await connectToDatabase();
  const collection: Collection = db.collection("sabcrm_view_field_group");

  await collection.updateOne({ id: entityId, workspaceId }, { $set: update });
};

export const updateViewFieldGroupExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
