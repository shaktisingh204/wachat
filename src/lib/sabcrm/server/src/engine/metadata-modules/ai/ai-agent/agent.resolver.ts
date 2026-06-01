"use server";

import "server-only";

// PORT-NOTE: Ported from twenty-server AgentResolver (NestJS GraphQL).
// @Query/@Mutation/@UseGuards/@UseInterceptors decorators removed.
// Exported as plain server action functions.
// Auth guards (WorkspaceAuthGuard, SettingsPermissionGuard AI / AI_SETTINGS) must be
// enforced by the calling Next.js route layer.
// AiModelRegistryService.validateModelAvailability wired to the ported stub.

import {
  createOneAgent,
  deleteOneAgent,
  findManyAgents,
  findOneAgentById,
  updateOneAgent,
  type FlatAgentWithRoleId,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/agent.service";
import type { AgentIdInput } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/dtos/agent-id.input";
import type { AgentDTO } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/dtos/agent.dto";
import type { CreateAgentInput } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/dtos/create-agent.input";
import type { UpdateAgentInput } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/dtos/update-agent.input";
import { validateModelAvailability } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service";

// Map a FlatAgentWithRoleId to AgentDTO shape.
// PORT-NOTE: In the source, fromFlatAgentWithRoleIdToAgentDto lives in
// src/engine/metadata-modules/flat-agent/utils/from-agent-entity-to-agent-dto.util.ts
// (not yet ported). Inlined here as a simple projection.
function fromFlatAgentWithRoleIdToAgentDto(
  flat: FlatAgentWithRoleId,
): AgentDTO {
  return {
    id: flat.id,
    name: flat.name,
    label: flat.label,
    icon: flat.icon ?? undefined,
    description: flat.description ?? undefined,
    prompt: flat.prompt,
    modelId: flat.modelId,
    responseFormat: flat.responseFormat as object | undefined,
    roleId: flat.roleId ?? undefined,
    isCustom: flat.isCustom,
    workspaceId: flat.workspaceId,
    createdAt: flat.createdAt,
    updatedAt: flat.updatedAt,
    modelConfiguration: flat.modelConfiguration ?? undefined,
    evaluationInputs: flat.evaluationInputs,
  };
}

// ---- Query: findManyAgents ----

export async function findManyAgentsAction({
  workspaceId,
}: {
  workspaceId: string;
}): Promise<AgentDTO[]> {
  const agents = await findManyAgents(workspaceId);

  return agents.map(fromFlatAgentWithRoleIdToAgentDto);
}

// ---- Query: findOneAgent ----

export async function findOneAgentAction({
  input,
  workspaceId,
}: {
  input: AgentIdInput;
  workspaceId: string;
}): Promise<AgentDTO> {
  const agent = await findOneAgentById({ id: input.id, workspaceId });

  return fromFlatAgentWithRoleIdToAgentDto(agent);
}

// ---- Mutation: createOneAgent ----

export async function createOneAgentAction({
  input,
  workspace,
}: {
  input: CreateAgentInput;
  workspace: { id: string };
}): Promise<AgentDTO> {
  if (input.modelId) {
    validateModelAvailability(input.modelId, workspace);
  }

  const created = await createOneAgent(
    { ...input, isCustom: true },
    workspace.id,
  );

  return fromFlatAgentWithRoleIdToAgentDto(created);
}

// ---- Mutation: updateOneAgent ----

export async function updateOneAgentAction({
  input,
  workspace,
}: {
  input: UpdateAgentInput;
  workspace: { id: string };
}): Promise<AgentDTO> {
  if (input.modelId) {
    validateModelAvailability(input.modelId, workspace);
  }

  const updated = await updateOneAgent({ input, workspaceId: workspace.id });

  return fromFlatAgentWithRoleIdToAgentDto(updated);
}

// ---- Mutation: deleteOneAgent ----

export async function deleteOneAgentAction({
  input,
  workspaceId,
}: {
  input: AgentIdInput;
  workspaceId: string;
}): Promise<AgentDTO> {
  const deleted = await deleteOneAgent(input.id, workspaceId);

  return fromFlatAgentWithRoleIdToAgentDto(deleted);
}
