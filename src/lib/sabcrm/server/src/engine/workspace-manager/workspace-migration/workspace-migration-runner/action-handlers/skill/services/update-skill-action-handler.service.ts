import "server-only";

import type { Collection } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";
import { findFlatEntityByUniversalIdentifierOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util";
import { resolveUniversalUpdateRelationIdentifiersToIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-update-relation-identifiers-to-ids.util";
import type {
  FlatUpdateSkillAction,
  UniversalUpdateSkillAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/skill/types/workspace-migration-skill-action.type";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

// Ported from NestJS UpdateSkillActionHandlerService — drops @Injectable DI,
// replaces TypeORM repository.update with Mongo updateOne on sabcrm_skill.

export const updateSkillTranspile = async (
  context: WorkspaceMigrationActionRunnerArgs<UniversalUpdateSkillAction>,
): Promise<FlatUpdateSkillAction> => {
  const { action, allFlatEntityMaps } = context;

  const flatSkill = findFlatEntityByUniversalIdentifierOrThrow({
    flatEntityMaps: allFlatEntityMaps.flatSkillMaps,
    universalIdentifier: action.universalIdentifier,
  });

  const update = resolveUniversalUpdateRelationIdentifiersToIds({
    metadataName: "skill",
    universalUpdate: action.update,
    allFlatEntityMaps,
  });

  return {
    type: "update",
    metadataName: "skill",
    entityId: flatSkill.id,
    update,
  };
};

export const updateSkillExecuteForMetadata = async (
  context: WorkspaceMigrationActionRunnerContext<FlatUpdateSkillAction>,
): Promise<void> => {
  const { flatAction, workspaceId } = context;
  const { entityId, update } = flatAction;

  const { db } = await connectToDatabase();
  const collection: Collection = db.collection("sabcrm_skill");

  await collection.updateOne({ id: entityId, workspaceId }, { $set: update });
};

export const updateSkillExecuteForWorkspaceSchema =
  async (): Promise<void> => {
    return;
  };
