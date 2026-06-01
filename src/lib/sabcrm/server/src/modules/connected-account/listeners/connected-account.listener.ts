import "server-only";

// server-logic: ConnectedAccountListener
// Handles connected-account DESTROYED events: removes the account from the
// "accounts to reconnect" list. Ported from NestJS event listener.

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: AccountsToReconnectService.removeAccountToReconnect is ported at
// src/lib/sabcrm/server/src/modules/connected-account/services/accounts-to-reconnect.service.ts
// Import from there once that file is ported.

// Inline stub so this file compiles independently.
async function removeAccountToReconnect(
  userId: string,
  workspaceId: string,
  connectedAccountId: string,
): Promise<void> {
  // PORT-NOTE: Delegate to AccountsToReconnectService once ported.
  // The original implementation removed an entry from user-vars storage keyed
  // by userId + workspaceId so the reconnect banner clears for that account.
  console.info(
    `[connected-account-listener] removeAccountToReconnect userId=${userId} workspaceId=${workspaceId} accountId=${connectedAccountId}`,
  );
}

interface UserWorkspaceDoc {
  id: string;
  userId: string;
  workspaceId: string;
}

async function getUserWorkspaceCollection() {
  const { db } = await connectToDatabase();
  return db.collection<UserWorkspaceDoc>("sabcrm_user_workspace");
}

export type ConnectedAccountDestroyedPayload = {
  workspaceId: string;
  events: Array<{
    properties: {
      before: {
        id: string;
        userWorkspaceId: string;
      };
    };
  }>;
};

/**
 * Handles connectedAccount DESTROYED events: clears "reconnect" state for the
 * affected user.
 *
 * PORT-NOTE: In Twenty this subscribed to OnDatabaseBatchEvent('connectedAccount',
 * DatabaseEventAction.DESTROYED). Wire this from SabNode's equivalent event
 * pipeline or call it directly from a delete API route.
 */
export async function handleConnectedAccountDestroyed(
  payload: ConnectedAccountDestroyedPayload,
): Promise<void> {
  const { workspaceId } = payload;

  const userWorkspaceCol = await getUserWorkspaceCollection();

  for (const eventPayload of payload.events) {
    const userWorkspaceId = eventPayload.properties.before.userWorkspaceId;

    const userWorkspace = await userWorkspaceCol.findOne({
      id: userWorkspaceId,
    });

    if (!userWorkspace) {
      continue;
    }

    const userId = userWorkspace.userId;
    const connectedAccountId = eventPayload.properties.before.id;

    await removeAccountToReconnect(userId, workspaceId, connectedAccountId);
  }
}
