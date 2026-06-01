import "server-only";

import type { Collection } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { findFlatEntityByUniversalIdentifierOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util";
import { resolveUniversalUpdateRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-update-relation-identifiers-to-ids.util";
import type {
  FlatUpdateRolePermissionFlagAction,
  UniversalUpdateRolePermissionFlagAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/role-permission-flag/types/workspace-migration-role-permission-flag-action.type";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS UpdateRolePermissionFlagActionHandlerService — drops @Injectable DI,
// replaces TypeORM repository.update with Mongo updateOne.

export const updateRolePermissionFlagTranspile = async (
  context: WorkspaceMigrationActionRunnerArgs<UniversalUpdateRolePermissionFlagAction>,
): Promise<FlatUpdateRolePermissionFlagAction> => {
  const { action, allFlatEntityMaps } = context;

  const flatRolePermissionFlag = findFlatEntityByUniversalIdentifierOrThrow({
    flatEntityMaps: allFlatEntityMaps.flatRolePermissionFlagMaps,
    universalIdentifier: action.universalIdentifier,
  });

  const update = resolveUniversalUpdateRelationIdentifiersToIds({
    metadataName: "rolePermissionFlag",
    universalUpdate: action.update,
    allFlatEntityMaps,
  });

  return {
    type: "update",
    metadataName: "rolePermissionFlag",
    entityId: flatRolePermissionFlag.id,
    update,
  };
};

export const updateRolePermissionFlagExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatUpdateRolePermissionFlagAction>,
): Promise<void> => {
  const { flatAction, workspaceId } = context;
  const { entityId, update } = flatAction;

  const { db } = await connectToDatabase();
  const collection: Collection = db.collection("sabcrm_role_permission_flag");

  await collection.updateOne({ id: entityId, workspaceId }, { $set: update });
};

export const updateRolePermissionFlagExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
