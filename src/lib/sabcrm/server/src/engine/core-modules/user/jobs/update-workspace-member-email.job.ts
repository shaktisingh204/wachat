import "server-only";

// PORT-NOTE: NestJS BullMQ @Processor / @Process job → plain async function.
// MessageQueue.workspaceQueue wiring is removed; callers should invoke
// handleUpdateWorkspaceMemberEmailJob() directly from their job runner
// (e.g. a background API route or a cron handler).

import { connectToDatabase } from "@/lib/mongodb";
import { findFirstWorkspaceIdByUserId } from "@/lib/sabcrm/server/src/engine/core-modules/user-workspace/user-workspace.service";

export type UpdateWorkspaceMemberEmailJobData = {
  userId: string;
  email: string;
};

export async function handleUpdateWorkspaceMemberEmailJob({
  userId,
  email,
}: UpdateWorkspaceMemberEmailJobData): Promise<void> {
  const workspaceId = await findFirstWorkspaceIdByUserId(userId);

  if (!workspaceId) {
    console.error(
      `[UpdateWorkspaceMemberEmailJob] No workspace found for userId=${userId}`,
    );
    return;
  }

  const { db } = await connectToDatabase();
  const workspaceMemberCol = db.collection("sabcrm_workspace_member");

  await workspaceMemberCol.updateMany(
    { userId },
    { $set: { userEmail: email, updatedAt: new Date() } },
  );
}
