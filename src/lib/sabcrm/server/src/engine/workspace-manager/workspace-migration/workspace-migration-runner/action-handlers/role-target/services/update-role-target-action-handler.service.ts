import "server-only";

import type { Collection } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { findFlatEntityByUniversalIdentifierOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util";
import { resolveUniversalUpdateRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-update-relation-identifiers-to-ids.util";
import type {
  FlatUpdateRoleTargetAction,
  UniversalUpdateRoleTargetAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/role-target/types/workspace-migration-role-target-action.type";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS UpdateRoleTargetActionHandlerService — drops @Injectable DI,
// replaces TypeORM repository.update with Mongo updateOne.

export const updateRoleTargetTranspile = async (
  context: WorkspaceMigrationActionRunnerArgs<UniversalUpdateRoleTargetAction>,
): Promise<FlatUpdateRoleTargetAction> => {
  const { action, allFlatEntityMaps } = context;

  const flatRoleTarget = findFlatEntityByUniversalIdentifierOrThrow({
    flatEntityMaps: allFlatEntityMaps.flatRoleTargetMaps,
    universalIdentifier: action.universalIdentifier,
  });

  const update = resolveUniversalUpdateRelationIdentifiersToIds({
    metadataName: "roleTarget",
    universalUpdate: action.update,
    allFlatEntityMaps,
  });

  return {
    type: "update",
    metadataName: "roleTarget",
    entityId: flatRoleTarget.id,
    update,
  };
};

export const updateRoleTargetExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatUpdateRoleTargetAction>,
): Promise<void> => {
  const { flatAction, workspaceId } = context;
  const { entityId, update } = flatAction;

  const { db } = await connectToDatabase();
  const collection: Collection = db.collection("sabcrm_role_target");

  await collection.updateOne({ id: entityId, workspaceId }, { $set: update });
};

export const updateRoleTargetExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
