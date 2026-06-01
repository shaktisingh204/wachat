"use server";

// resolver->action: ChannelSyncResolver → server action
// Mutation: startChannelSync(connectedAccountId) → ChannelSyncSuccessDTO

import type { ChannelSyncSuccessDTO } from "./dtos/channel-sync-success.dto";
import { startChannelSync } from "./services/channel-sync.service";

// PORT-NOTE: Original resolver used NestJS guards for:
//   1. WorkspaceAuthGuard   — authenticate the workspace session
//   2. SettingsPermissionGuard(PermissionFlagType.CONNECTED_ACCOUNTS) — RBAC
//   3. connectedAccountMetadataService.verifyOwnership — ownership check
// In SabNode callers must enforce these guards before invoking this action.

export type StartChannelSyncArgs = {
  connectedAccountId: string;
  workspaceId: string;
  userWorkspaceId: string;
};

export async function channelSyncAction(
  args: StartChannelSyncArgs,
): Promise<ChannelSyncSuccessDTO> {
  const { connectedAccountId, workspaceId } = args;

  // PORT-NOTE: ownership verification was done via ConnectedAccountMetadataService.
  // Callers should verify ownership before invoking this action:
  //   import { verifyConnectedAccountOwnership } from "@/lib/sabcrm/server/src/engine/metadata-modules/connected-account/connected-account-metadata.service";
  //   await verifyConnectedAccountOwnership({ id: connectedAccountId, userWorkspaceId, workspaceId });

  await startChannelSync({ connectedAccountId, workspaceId });

  return { success: true };
}
