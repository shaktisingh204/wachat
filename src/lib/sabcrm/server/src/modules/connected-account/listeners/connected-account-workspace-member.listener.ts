import "server-only";

// server-logic: ConnectedAccountWorkspaceMemberListener
// Enqueues a cleanup job when a workspace member is deleted or destroyed.
// Ported from NestJS event listener to a plain async handler.

import {
  deleteWorkspaceMemberConnectedAccounts,
  type DeleteWorkspaceMemberConnectedAccountsCleanupJobData,
} from "../jobs/delete-workspace-member-connected-accounts.job";

// PORT-NOTE: In Twenty this listener subscribed to OnDatabaseBatchEvent for
// 'workspaceMember' DELETED and DESTROYED actions via BullMQ
// (MessageQueue.deleteCascadeQueue). In SabNode, wire this handler to the
// equivalent workspace-event pipeline or call it directly from a delete API
// route.

export type WorkspaceMemberBatchPayload = {
  workspaceId: string;
  events: Array<{ recordId: string }>;
};

/**
 * Handles workspace-member removal events: enqueues connected-account cleanup
 * for every removed member.
 *
 * In Twenty this ran async via a delete-cascade queue. Here we run serially;
 * SabNode callers may fan out to a queue as needed.
 */
export async function handleConnectedAccountWorkspaceMemberRemoval(
  payload: WorkspaceMemberBatchPayload,
): Promise<void> {
  const jobs: DeleteWorkspaceMemberConnectedAccountsCleanupJobData[] =
    payload.events.map((eventPayload) => ({
      workspaceId: payload.workspaceId,
      workspaceMemberId: eventPayload.recordId,
    }));

  await Promise.all(
    jobs.map((jobData) => deleteWorkspaceMemberConnectedAccounts(jobData)),
  );
}
