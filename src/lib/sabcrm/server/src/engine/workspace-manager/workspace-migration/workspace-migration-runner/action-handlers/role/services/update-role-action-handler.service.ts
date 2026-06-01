import "server-only";

import type { Collection } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { findFlatEntityByUniversalIdentifierOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util";
import { resolveUniversalUpdateRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-update-relation-identifiers-to-ids.util";
import type {
  FlatUpdateRoleAction,
  UniversalUpdateRoleAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/role/types/workspace-migration-role-action.type";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS UpdateRoleActionHandlerService — drops @Injectable DI,
// replaces TypeORM repository.update with Mongo updateOne on sabcrm_role.

export const updateRoleTranspile = async (
  context: WorkspaceMigrationActionRunnerArgs<UniversalUpdateRoleAction>,
): Promise<FlatUpdateRoleAction> => {
  const { action, allFlatEntityMaps } = context;

  const flatRole = findFlatEntityByUniversalIdentifierOrThrow({
    flatEntityMaps: allFlatEntityMaps.flatRoleMaps,
    universalIdentifier: action.universalIdentifier,
  });

  const update = resolveUniversalUpdateRelationIdentifiersToIds({
    metadataName: "role",
    universalUpdate: action.update,
    allFlatEntityMaps,
  });

  return {
    type: "update",
    metadataName: "role",
    entityId: flatRole.id,
    update,
  };
};

export const updateRoleExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatUpdateRoleAction>,
): Promise<void> => {
  const { flatAction, workspaceId } = context;
  const { entityId, update } = flatAction;

  const { db } = await connectToDatabase();
  const collection: Collection = db.collection("sabcrm_role");

  await collection.updateOne({ id: entityId, workspaceId }, { $set: update });
};

export const updateRoleExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
