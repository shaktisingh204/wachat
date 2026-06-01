import "server-only";

// PORT-NOTE: Ported from twenty-server AiAgentRoleService (NestJS Injectable).
// NestJS DI decorators and TypeORM operators removed.
// WorkspaceScopedRepository replaced with Mongo collection accessors.
// Role and RoleTarget entity imports point to their expected target paths
// (to be ported in future batches).

import { getAgentCollection } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/entities/agent.entity";
import { getRoleCollection } from "@/lib/sabcrm/server/src/engine/metadata-modules/role/role.entity";
import { getRoleTargetCollection } from "@/lib/sabcrm/server/src/engine/metadata-modules/role-target/role-target.entity";
import { createRoleTarget } from "@/lib/sabcrm/server/src/engine/metadata-modules/role-target/services/role-target.service";
import { deleteRoleTarget } from "@/lib/sabcrm/server/src/engine/metadata-modules/role-target/services/role-target.service";
import type { AgentDocument } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/entities/agent.entity";

// --- Public surface ---

export async function assignRoleToAgent({
  workspaceId,
  agentId,
  roleId,
}: {
  workspaceId: string;
  agentId: string;
  roleId: string;
}): Promise<void> {
  const validationResult = await validateAssignRoleInput({
    agentId,
    workspaceId,
    roleId,
  });

  if (validationResult?.roleToAssignIsSameAsCurrentRole) {
    return;
  }

  await createRoleTarget({
    createRoleTargetInput: {
      roleId,
      targetId: agentId,
      targetMetadataForeignKey: "agentId",
    },
    workspaceId,
  });
}

export async function removeRoleFromAgent({
  workspaceId,
  agentId,
}: {
  workspaceId: string;
  agentId: string;
}): Promise<void> {
  const roleTargetCollection = await getRoleTargetCollection();

  const existingRoleTarget = await roleTargetCollection.findOne({
    agentId,
    workspaceId,
  });

  if (!existingRoleTarget) {
    throw new Error(`Role target not found for agent ${agentId}`);
  }

  await deleteRoleTarget({
    id: existingRoleTarget._id.toHexString(),
    workspaceId,
  });
}

export async function getAgentsAssignedToRole(
  roleId: string,
  workspaceId: string,
): Promise<AgentDocument[]> {
  const roleTargetCollection = await getRoleTargetCollection();

  const roleTargets = await roleTargetCollection
    .find({
      roleId,
      workspaceId,
      agentId: { $ne: null },
    })
    .toArray();

  const agentIds = roleTargets
    .map((rt) => rt.agentId)
    .filter((id): id is string => id != null);

  if (!agentIds.length) {
    return [];
  }

  const agentCollection = await getAgentCollection();

  return agentCollection.find({ id: { $in: agentIds }, workspaceId }).toArray();
}

export async function deleteAgentOnlyRoleIfUnused({
  roleId,
  roleTargetId,
  workspaceId,
}: {
  roleId: string;
  roleTargetId: string;
  workspaceId: string;
}): Promise<void> {
  const roleCollection = await getRoleCollection();

  const role = await roleCollection.findOne({ id: roleId, workspaceId });

  if (
    !role ||
    !role.canBeAssignedToAgents ||
    role.canBeAssignedToUsers ||
    role.canBeAssignedToApiKeys
  ) {
    return;
  }

  const roleTargetCollection = await getRoleTargetCollection();

  const remainingCount = await roleTargetCollection.countDocuments({
    roleId,
    workspaceId,
    id: { $ne: roleTargetId },
  });

  if (remainingCount === 0) {
    await roleCollection.deleteOne({ id: roleId, workspaceId });
  }
}

// --- Private helpers ---

async function validateAssignRoleInput({
  agentId,
  workspaceId,
  roleId,
}: {
  agentId: string;
  workspaceId: string;
  roleId: string;
}): Promise<{ roleToAssignIsSameAsCurrentRole: boolean }> {
  const agentCollection = await getAgentCollection();

  const agent = await agentCollection.findOne({ id: agentId, workspaceId });

  if (!agent) {
    throw new Error(`Agent with id ${agentId} not found in workspace`);
  }

  const roleCollection = await getRoleCollection();

  const role = await roleCollection.findOne({ id: roleId, workspaceId });

  if (!role) {
    throw new Error(`Role with id ${roleId} not found in workspace`);
  }

  if (!role.canBeAssignedToAgents) {
    throw new Error(`Role "${role.label}" cannot be assigned to agents`);
  }

  const roleTargetCollection = await getRoleTargetCollection();

  const existingRoleTarget = await roleTargetCollection.findOne({
    agentId,
    roleId,
    workspaceId,
  });

  return {
    roleToAssignIsSameAsCurrentRole: Boolean(existingRoleTarget),
  };
}
