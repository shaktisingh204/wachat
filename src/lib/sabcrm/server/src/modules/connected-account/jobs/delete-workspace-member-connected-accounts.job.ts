import "server-only";

// server-logic: DeleteWorkspaceMemberConnectedAccountsCleanupJob
// Deletes all connected accounts belonging to a workspace member when they
// are removed from the workspace. Ported from BullMQ processor to a plain
// async function that can be called by SabNode's job queue.

import { connectToDatabase } from "@/lib/mongodb";

export type DeleteWorkspaceMemberConnectedAccountsCleanupJobData = {
  workspaceId: string;
  workspaceMemberId: string;
};

interface WorkspaceMemberDoc {
  id: string;
  userId: string;
  [key: string]: unknown;
}

interface UserWorkspaceDoc {
  id: string;
  userId: string;
  workspaceId: string;
  [key: string]: unknown;
}

async function getWorkspaceMemberCollection() {
  const { db } = await connectToDatabase();
  return db.collection<WorkspaceMemberDoc>("sabcrm_workspace_member");
}

async function getUserWorkspaceCollection() {
  const { db } = await connectToDatabase();
  return db.collection<UserWorkspaceDoc>("sabcrm_user_workspace");
}

async function getConnectedAccountCollection() {
  const { db } = await connectToDatabase();
  return db.collection("sabcrm_connected_account");
}

export async function deleteWorkspaceMemberConnectedAccounts(
  data: DeleteWorkspaceMemberConnectedAccountsCleanupJobData,
): Promise<void> {
  const { workspaceId, workspaceMemberId } = data;

  const workspaceMemberCol = await getWorkspaceMemberCollection();

  const member = await workspaceMemberCol.findOne({
    id: workspaceMemberId,
  });

  if (!member) {
    return;
  }

  const userWorkspaceCol = await getUserWorkspaceCollection();

  const userWorkspace = await userWorkspaceCol.findOne({
    userId: member.userId,
    workspaceId,
  });

  if (!userWorkspace) {
    return;
  }

  const connectedAccountCol = await getConnectedAccountCollection();

  await connectedAccountCol.deleteMany({
    userWorkspaceId: userWorkspace.id,
    workspaceId,
  });
}
