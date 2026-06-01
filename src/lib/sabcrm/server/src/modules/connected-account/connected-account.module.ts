// module-wiring: NestJS ConnectedAccountModule → SabNode registry
// Re-exports the ported pieces this module wired.

export { deleteWorkspaceMemberConnectedAccounts } from "./jobs/delete-workspace-member-connected-accounts.job";
export type { DeleteWorkspaceMemberConnectedAccountsCleanupJobData } from "./jobs/delete-workspace-member-connected-accounts.job";

export { handleConnectedAccountWorkspaceMemberRemoval } from "./listeners/connected-account-workspace-member.listener";
export { handleConnectedAccountDestroyed } from "./listeners/connected-account.listener";

// AccountsToReconnectService (exported by original module):
// PORT-NOTE: port is in src/lib/sabcrm/server/src/modules/connected-account/services/accounts-to-reconnect.service.ts

// Dependencies wired by this module:
//   UserVarsModule          → src/lib/sabcrm/server/src/engine/core-modules/user/user-vars/
//   ConnectedAccountEntity  → sabcrm_connected_account collection
//   UserWorkspaceEntity     → sabcrm_user_workspace collection
