import "server-only";

import type { Collection } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { findFlatEntityByUniversalIdentifierOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util";
import { resolveUniversalUpdateRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-update-relation-identifiers-to-ids.util";
import type {
  FlatUpdatePermissionFlagAction,
  UniversalUpdatePermissionFlagAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/permission-flag/types/workspace-migration-permission-flag-action.type";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS UpdatePermissionFlagActionHandlerService — drops @Injectable DI,
// replaces TypeORM repository.update with Mongo updateOne filtered by id + workspaceId.

export const updatePermissionFlagTranspile = async (
  context: WorkspaceMigrationActionRunnerArgs<UniversalUpdatePermissionFlagAction>,
): Promise<FlatUpdatePermissionFlagAction> => {
  const { action, allFlatEntityMaps } = context;

  const flatDefinition = findFlatEntityByUniversalIdentifierOrThrow({
    flatEntityMaps: allFlatEntityMaps.flatPermissionFlagMaps,
    universalIdentifier: action.universalIdentifier,
  });

  const update = resolveUniversalUpdateRelationIdentifiersToIds({
    metadataName: "permissionFlag",
    universalUpdate: action.update,
    allFlatEntityMaps,
  });

  return {
    type: "update",
    metadataName: "permissionFlag",
    entityId: flatDefinition.id,
    update,
  };
};

export const updatePermissionFlagExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatUpdatePermissionFlagAction>,
): Promise<void> => {
  const { flatAction, workspaceId } = context;
  const { entityId, update } = flatAction;

  const { db } = await connectToDatabase();
  const collection: Collection = db.collection("sabcrm_permission_flag");

  await collection.updateOne({ id: entityId, workspaceId }, { $set: update });
};

export const updatePermissionFlagExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
