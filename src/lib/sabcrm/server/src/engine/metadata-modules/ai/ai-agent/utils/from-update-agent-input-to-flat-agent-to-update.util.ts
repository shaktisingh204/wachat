import "server-only";

// PORT-NOTE: Originally from twenty-server. Ported to SabNode (Next.js + Mongo).
// NestJS DI removed; plain exported functions. Lingui msg tags kept as string literals.
// twenty-shared/utils replaced with inline helpers; internal type imports point to ported targets.

import { v4 } from "uuid";

import type { UpdateAgentInput } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/dtos/update-agent.input";
import { FLAT_AGENT_EDITABLE_PROPERTIES } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-agent/constants/flat-agent-editable-properties.constant";
import type { FlatAgentMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-agent/types/flat-agent-maps.type";
import type { FlatAgent } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-agent/types/flat-agent.type";
import type { FlatRoleTargetByAgentIdMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-agent/types/flat-role-target-by-agent-id-maps.type";
import type { AllFlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/all-flat-entity-maps.type";
import { findFlatEntityByIdInFlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util";
import { findFlatEntityByIdInFlatEntityMapsOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps-or-throw.util";
import type { FlatRoleTarget } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-role-target/types/flat-role-target.type";
import { computeMetadataNameFromLabelOrThrow } from "@/lib/sabcrm/server/src/engine/metadata-modules/utils/compute-metadata-name-from-label-or-throw.util";
import { mergeUpdateInExistingRecord } from "@/lib/sabcrm/server/src/utils/merge-update-in-existing-record.util";
import {
  AiException,
  AiExceptionCode,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai.exception";

// ---------------------------------------------------------------------------
// Inline helpers (replaces twenty-shared/utils)
// ---------------------------------------------------------------------------

const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

/**
 * Trims whitespace and collapses repeated spaces for the requested string keys.
 */
function trimAndRemoveDuplicatedWhitespacesFromObjectStringProperties<
  T extends Record<string, unknown>,
>(obj: T, keys: (keyof T)[]): T {
  const result = { ...obj };
  for (const key of keys) {
    const val = result[key];
    if (typeof val === "string") {
      (result as Record<keyof T, unknown>)[key] = val
        .trim()
        .replace(/\s+/g, " ");
    }
  }
  return result;
}

/**
 * Copies only the listed properties from `source`, trimming string values.
 */
function extractAndSanitizeObjectStringFields<
  T extends Record<string, unknown>,
>(source: T, properties: readonly (keyof T)[]): Partial<T> {
  const result: Partial<T> = {};
  for (const prop of properties) {
    if (prop in source) {
      const val = source[prop];
      (result as Record<keyof T, unknown>)[prop] =
        typeof val === "string" ? val.trim().replace(/\s+/g, " ") : val;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type FlatRoleTargetToUpdateCreateDelete = {
  flatRoleTargetToUpdate?: FlatRoleTarget;
  flatRoleTargetToCreate?: FlatRoleTarget;
  flatRoleTargetToDelete?: FlatRoleTarget;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const computeAgentFlatRoleTargetToUpdate = ({
  roleId,
  flatAgent,
  flatRoleTargetByAgentIdMaps,
  flatRoleMaps,
}: {
  roleId: string | null | undefined;
  flatRoleTargetByAgentIdMaps: FlatRoleTargetByAgentIdMaps;
  flatAgent: FlatAgent;
  flatRoleMaps: AllFlatEntityMaps["flatRoleMaps"];
}): FlatRoleTargetToUpdateCreateDelete => {
  if (roleId === undefined) {
    return {};
  }

  const existingRoleTarget = flatRoleTargetByAgentIdMaps[flatAgent.id];
  const updatedAt = new Date().toISOString();

  if (roleId === null) {
    if (isDefined(existingRoleTarget)) {
      return { flatRoleTargetToDelete: existingRoleTarget };
    }
    return {};
  }

  const flatRole = findFlatEntityByIdInFlatEntityMapsOrThrow({
    flatEntityMaps: flatRoleMaps,
    flatEntityId: roleId,
  });

  if (isDefined(existingRoleTarget)) {
    return {
      flatRoleTargetToUpdate: {
        ...existingRoleTarget,
        roleId,
        roleUniversalIdentifier: flatRole.universalIdentifier,
        updatedAt,
      },
    };
  }

  return {
    flatRoleTargetToCreate: {
      id: v4(),
      roleId,
      roleUniversalIdentifier: flatRole.universalIdentifier,
      userWorkspaceId: null,
      agentId: flatAgent.id,
      apiKeyId: null,
      createdAt: updatedAt,
      updatedAt,
      universalIdentifier: v4(),
      workspaceId: flatAgent.workspaceId,
      applicationId: flatAgent.applicationId,
      applicationUniversalIdentifier: flatAgent.applicationUniversalIdentifier,
    } as FlatRoleTarget,
  };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type FromUpdateAgentInputToFlatAgentToUpdateArgs = {
  updateAgentInput: UpdateAgentInput;
  flatAgentMaps: FlatAgentMaps;
  flatRoleTargetByAgentIdMaps: FlatRoleTargetByAgentIdMaps;
} & Pick<AllFlatEntityMaps, "flatRoleMaps">;

export const fromUpdateAgentInputToFlatAgentToUpdate = ({
  updateAgentInput: rawUpdateAgentInput,
  flatAgentMaps,
  flatRoleTargetByAgentIdMaps,
  flatRoleMaps,
}: FromUpdateAgentInputToFlatAgentToUpdateArgs): {
  flatAgentToUpdate: FlatAgent;
} & FlatRoleTargetToUpdateCreateDelete => {
  const { id: agentIdToUpdate } =
    trimAndRemoveDuplicatedWhitespacesFromObjectStringProperties(
      rawUpdateAgentInput,
      ["id"],
    );

  const existingFlatAgent = findFlatEntityByIdInFlatEntityMaps({
    flatEntityId: agentIdToUpdate,
    flatEntityMaps: flatAgentMaps,
  });

  if (!isDefined(existingFlatAgent)) {
    throw new AiException("Agent not found", AiExceptionCode.AGENT_NOT_FOUND, {
      userFriendlyMessage:
        "The agent you are looking for could not be found. It may have been deleted or you may not have access to it.",
    });
  }

  const updatedEditableAgentProperties = extractAndSanitizeObjectStringFields(
    rawUpdateAgentInput,
    FLAT_AGENT_EDITABLE_PROPERTIES,
  );

  if (
    isDefined(updatedEditableAgentProperties.label) &&
    !isDefined(updatedEditableAgentProperties.name)
  ) {
    updatedEditableAgentProperties.name = computeMetadataNameFromLabelOrThrow(
      updatedEditableAgentProperties.label as string,
    );
  }

  const flatAgentToUpdate: FlatAgent = mergeUpdateInExistingRecord({
    existing: existingFlatAgent,
    properties: FLAT_AGENT_EDITABLE_PROPERTIES,
    update: updatedEditableAgentProperties,
  });

  const {
    flatRoleTargetToUpdate,
    flatRoleTargetToCreate,
    flatRoleTargetToDelete,
  } = computeAgentFlatRoleTargetToUpdate({
    roleId: rawUpdateAgentInput.roleId,
    flatAgent: existingFlatAgent,
    flatRoleTargetByAgentIdMaps,
    flatRoleMaps,
  });

  return {
    flatAgentToUpdate,
    flatRoleTargetToUpdate,
    flatRoleTargetToCreate,
    flatRoleTargetToDelete,
  };
};
