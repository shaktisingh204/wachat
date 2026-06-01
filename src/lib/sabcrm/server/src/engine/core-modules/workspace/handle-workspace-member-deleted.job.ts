import "server-only";

// PORT-NOTE: Original is a NestJS BullMQ @Processor job on workspaceQueue.
// Ported to a plain exported async function to be invoked by a background
// worker (Vercel Function, cron handler, or queue consumer) at the route layer.

import { handleRemoveWorkspaceMember } from "@/lib/sabcrm/server/src/engine/core-modules/workspace/services/workspace.service";

export type HandleWorkspaceMemberDeletedJobData = {
  workspaceId: string;
  userId: string;
};

export async function handleWorkspaceMemberDeletedJob(
  data: HandleWorkspaceMemberDeletedJobData,
): Promise<void> {
  const { workspaceId, userId } = data;

  await handleRemoveWorkspaceMember(workspaceId, userId);
}
