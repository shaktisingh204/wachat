import "server-only";

// PORT-NOTE: Stub for twenty-server RoleTargetService (NestJS Injectable).
// Full port deferred to the role-target batch.
// This stub provides the function surface used by ai-agent-role.service.ts.

import { v4 } from "uuid";
import { getRoleTargetCollection } from "@/lib/sabcrm/server/src/engine/metadata-modules/role-target/role-target.entity";

export async function createRoleTarget({
  createRoleTargetInput,
  workspaceId,
}: {
  createRoleTargetInput: {
    roleId: string;
    targetId: string;
    targetMetadataForeignKey: string;
  };
  workspaceId: string;
}): Promise<void> {
  const collection = await getRoleTargetCollection();

  const { roleId, targetId, targetMetadataForeignKey } = createRoleTargetInput;

  const doc = {
    id: v4(),
    workspaceId,
    roleId,
    agentId: targetMetadataForeignKey === "agentId" ? targetId : null,
    userWorkspaceId:
      targetMetadataForeignKey === "userWorkspaceId" ? targetId : null,
    apiKeyId: targetMetadataForeignKey === "apiKeyId" ? targetId : null,
  };

  await collection.insertOne(doc as Parameters<typeof collection.insertOne>[0]);
}

export async function deleteRoleTarget({
  id,
  workspaceId,
}: {
  id: string;
  workspaceId: string;
}): Promise<void> {
  const collection = await getRoleTargetCollection();

  await collection.deleteOne({ id, workspaceId });
}
