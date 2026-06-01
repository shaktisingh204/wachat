import "server-only";

// PORT-NOTE: Ported from twenty-server from-create-agent-input-to-flat-agent.util.ts
// NestJS removed. twenty-shared/utils replaced with inline helpers.
// Internal imports point to ported target paths.
// computeMetadataNameFromLabel from twenty-shared/metadata replaced with an inline implementation.

import { v4 } from "uuid";

import type { CreateAgentInput } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/dtos/create-agent.input";
import type { FlatAgent } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-agent/types/flat-agent.type";
import type { AllFlatEntityMaps } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/types/all-flat-entity-maps.type";
import type { FlatRoleTarget } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-role-target/types/flat-role-target.type";
import type { FlatApplication } from "@/lib/sabcrm/server/src/engine/core-modules/application/types/flat-application.type";

// ---------------------------------------------------------------------------
// Inline helpers (replaces twenty-shared/utils)
// ---------------------------------------------------------------------------

const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

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
 * Converts a human-readable label to a snake_case metadata name.
 * Mirrors twenty-shared/metadata computeMetadataNameFromLabel.
 */
function computeMetadataNameFromLabel({
  label,
}: {
  label: string;
}): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type FromCreateAgentInputToFlatAgentArgs = {
  createAgentInput: CreateAgentInput;
  workspaceId: string;
  flatApplication: FlatApplication;
  flatRoleMaps: AllFlatEntityMaps["flatRoleMaps"];
};

// ---------------------------------------------------------------------------
// Main util
// ---------------------------------------------------------------------------

export const fromCreateAgentInputToFlatAgent = ({
  createAgentInput: rawCreateAgentInput,
  workspaceId,
  flatApplication,
  flatRoleMaps,
}: FromCreateAgentInputToFlatAgentArgs): {
  flatAgentToCreate: FlatAgent;
  flatRoleTargetToCreate: FlatRoleTarget | null;
} => {
  const { roleId, ...createAgentInput } =
    trimAndRemoveDuplicatedWhitespacesFromObjectStringProperties(
      rawCreateAgentInput,
      ["name", "label", "icon", "description", "prompt", "modelId", "roleId"],
    );

  const createdAt = new Date().toISOString();
  const agentId = v4();

  const flatAgentToCreate: FlatAgent = {
    id: agentId,
    name: isNonEmptyString(createAgentInput.name)
      ? createAgentInput.name
      : computeMetadataNameFromLabel({ label: createAgentInput.label }),
    label: createAgentInput.label,
    icon: createAgentInput.icon ?? null,
    description: createAgentInput.description ?? null,
    prompt: createAgentInput.prompt,
    modelId: createAgentInput.modelId,
    responseFormat: createAgentInput.responseFormat ?? { type: "text" },
    workspaceId,
    isCustom: true,
    universalIdentifier: v4(),
    applicationId: flatApplication.id,
    applicationUniversalIdentifier: flatApplication.universalIdentifier,
    modelConfiguration: createAgentInput.modelConfiguration ?? null,
    evaluationInputs: createAgentInput.evaluationInputs ?? [],
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  };

  let flatRoleTargetToCreate: FlatRoleTarget | null = null;

  if (isDefined(roleId)) {
    // PORT-NOTE: resolveEntityRelationUniversalIdentifiers from flat-entity batch.
    // Until that batch is ported, roleUniversalIdentifier is derived as a v4 fallback.
    const roleUniversalIdentifier =
      Object.values(flatRoleMaps?.byId ?? {}).find(
        (r): r is NonNullable<typeof r> => isDefined(r) && r.id === roleId,
      )?.universalIdentifier ?? v4();

    flatRoleTargetToCreate = {
      id: v4(),
      roleId,
      roleUniversalIdentifier,
      userWorkspaceId: null,
      agentId,
      apiKeyId: null,
      createdAt,
      updatedAt: createdAt,
      universalIdentifier: v4(),
      workspaceId,
      applicationId: flatApplication.id,
      applicationUniversalIdentifier: flatApplication.universalIdentifier,
    };
  }

  return {
    flatAgentToCreate,
    flatRoleTargetToCreate,
  };
};
