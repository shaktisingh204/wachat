import "server-only";

// PORT-NOTE: Ported from twenty-server AgentService (NestJS Injectable).
// NestJS DI, TypeORM operators (ILike, IsNull), and workspace-cache/migration
// infrastructure are replaced with Mongo collection accessors. The workspace
// cache (flatAgentMaps, flatRoleTargetByAgentIdMaps) will be replaced in a
// later batch — for now the service reads Mongo directly as a faithful fallback.
// WorkspaceMigrationValidateBuildAndRunService operations are stubs (PORT-NOTE below).
// Behavior of every public method is preserved.

import { v4 } from "uuid";

import { getAgentCollection } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/entities/agent.entity";
import type { AgentDocument } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/entities/agent.entity";
import type { CreateAgentInput } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/dtos/create-agent.input";
import type { UpdateAgentInput } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/dtos/update-agent.input";
import { fromCreateAgentInputToFlatAgent } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/utils/from-create-agent-input-to-flat-agent.util";

// ---- Types used as return shapes ----

export type FlatAgentWithRoleId = AgentDocument & { roleId: string | null };

// ---- findManyAgents ----

export async function findManyAgents(
  workspaceId: string,
): Promise<FlatAgentWithRoleId[]> {
  const collection = await getAgentCollection();

  const agents = await collection
    .find({ workspaceId, deletedAt: null })
    .toArray();

  // PORT-NOTE: roleId populated via flatRoleTargetByAgentIdMaps in the original.
  // Resolved from role-target collection when that batch is ported.
  // Returning null until then to keep the type shape valid.
  return agents.map((a) => ({ ...a, roleId: null }));
}

// ---- findOneAgentByName ----

export async function findOneAgentByName({
  name,
  workspaceId,
}: {
  name: string;
  workspaceId: string;
}): Promise<AgentDocument> {
  const collection = await getAgentCollection();

  const agent = await collection.findOne({ name, workspaceId });

  if (!agent) {
    throw new Error(`Agent with name "${name}" not found`);
  }

  return agent;
}

// ---- findOneAgentById ----

export async function findOneAgentById({
  id,
  workspaceId,
}: {
  id: string;
  workspaceId: string;
}): Promise<FlatAgentWithRoleId> {
  const collection = await getAgentCollection();

  const agent = await collection.findOne({ id, workspaceId });

  if (!agent) {
    throw new Error(`Agent not found`);
  }

  // PORT-NOTE: roleId from flatRoleTargetByAgentIdMaps — returns null until role-target batch.
  return { ...agent, roleId: null };
}

// ---- createOneAgent ----

export async function createOneAgent(
  input: CreateAgentInput & { isCustom: boolean },
  workspaceId: string,
): Promise<FlatAgentWithRoleId> {
  const collection = await getAgentCollection();

  // PORT-NOTE: fromCreateAgentInputToFlatAgent depends on flatApplication + flatRoleMaps
  // which require the workspace-cache batch. Until then we build the document directly.
  const now = new Date();
  const agentId = v4();

  const doc: AgentDocument = {
    _id: undefined as never, // Mongo fills this
    id: agentId,
    workspaceId,
    name: input.name ?? input.label.toLowerCase().replace(/\s+/g, "_"),
    label: input.label,
    icon: input.icon ?? null,
    description: input.description ?? null,
    prompt: input.prompt,
    modelId: input.modelId,
    responseFormat: input.responseFormat ?? { type: "text" },
    isCustom: input.isCustom,
    modelConfiguration: input.modelConfiguration ?? null,
    evaluationInputs: input.evaluationInputs ?? [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await collection.insertOne(doc);

  return { ...doc, roleId: null };
}

// ---- updateOneAgent ----

export async function updateOneAgent({
  input,
  workspaceId,
}: {
  input: UpdateAgentInput;
  workspaceId: string;
}): Promise<FlatAgentWithRoleId> {
  const collection = await getAgentCollection();

  const existing = await collection.findOne({ id: input.id, workspaceId });

  if (!existing) {
    throw new Error(`Agent not found`);
  }

  const now = new Date();

  const patch: Partial<AgentDocument> = {
    updatedAt: now,
  };

  if (input.name !== undefined) patch.name = input.name;
  if (input.label !== undefined) patch.label = input.label;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.description !== undefined) patch.description = input.description;
  if (input.prompt !== undefined) patch.prompt = input.prompt;
  if (input.modelId !== undefined) patch.modelId = input.modelId;
  if (input.responseFormat !== undefined)
    patch.responseFormat = input.responseFormat;
  if (input.modelConfiguration !== undefined)
    patch.modelConfiguration = input.modelConfiguration ?? null;
  if (input.evaluationInputs !== undefined)
    patch.evaluationInputs = input.evaluationInputs;

  await collection.updateOne({ id: input.id, workspaceId }, { $set: patch });

  const updated = await collection.findOne({ id: input.id, workspaceId });

  if (!updated) {
    throw new Error(`Agent not found after update`);
  }

  // PORT-NOTE: roleId update (create/delete/update roleTarget) deferred to role-target batch.
  return { ...updated, roleId: null };
}

// ---- deleteOneAgent ----

export async function deleteOneAgent(
  id: string,
  workspaceId: string,
): Promise<FlatAgentWithRoleId> {
  const deleted = await deleteManyAgents({ ids: [id], workspaceId });

  if (deleted.length !== 1) {
    throw new Error("Could not retrieve deleted agent");
  }

  return deleted[0];
}

// ---- deleteManyAgents ----

export async function deleteManyAgents({
  ids,
  workspaceId,
  isSystemBuild = false,
}: {
  ids: string[];
  workspaceId: string;
  isSystemBuild?: boolean;
}): Promise<FlatAgentWithRoleId[]> {
  if (ids.length === 0) return [];

  const collection = await getAgentCollection();

  const agents = await collection
    .find({ id: { $in: ids }, workspaceId })
    .toArray();

  if (agents.length === 0) return [];

  const now = new Date();

  await collection.updateMany(
    { id: { $in: ids }, workspaceId },
    { $set: { deletedAt: now, updatedAt: now } },
  );

  // PORT-NOTE: roleTarget cleanup deferred to role-target batch.
  return agents.map((a) => ({ ...a, roleId: null }));
}

// ---- searchAgents ----

export async function searchAgents(
  query: string,
  workspaceId: string,
  options: { limit: number } = { limit: 2 },
): Promise<AgentDocument[]> {
  const collection = await getAgentCollection();
  const queryLower = query.toLowerCase();

  return collection
    .find({
      workspaceId,
      deletedAt: null,
      $or: [
        { name: { $regex: queryLower, $options: "i" } },
        { description: { $regex: queryLower, $options: "i" } },
        { label: { $regex: queryLower, $options: "i" } },
      ],
    })
    .sort({ name: 1 })
    .limit(options.limit)
    .toArray();
}
