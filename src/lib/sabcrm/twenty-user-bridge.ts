import 'server-only';

/**
 * C6 — SabNode → Twenty identity bridge (Phase 0 contract).
 *
 * Maps a SabNode (user, project) pair onto Twenty's (user, workspace, role) and
 * mints a scoped access token for the GraphQL client (C5). The central tenancy
 * rule: **one SabNode `project` = one Twenty `workspace`** (PLAN.md §4), with the
 * link persisted as `projects.twentyWorkspaceId` (Mongo) and
 * `sabnode_identity.users.twenty_user_id` (Postgres).
 *
 * Phase 0 defines the signature only. The body is wired in Phase 4 (Agent 4A):
 * provision/lookup the Twenty workspace, ensure the Twenty user + workspaceMember
 * exist, resolve the role (via C7), and mint the token. Until then it throws a
 * clear, typed error so any premature caller fails loudly rather than silently.
 */

import type { TwentyRole } from './twenty-rbac-bridge';

export interface TwentyBridge {
  twentyWorkspaceId: string;
  twentyUserId: string;
  twentyRole: TwentyRole;
  /** Short-lived bearer token scoped to the workspace + user. */
  token: string;
}

export class TwentyBridgeNotConfiguredError extends Error {
  constructor(message = 'Twenty user bridge is not wired yet (Phase 4).') {
    super(message);
    this.name = 'TwentyBridgeNotConfiguredError';
  }
}

/**
 * Resolve the Twenty identity for a SabNode user acting in a project.
 *
 * @throws {TwentyBridgeNotConfiguredError} until Phase 4 implements provisioning.
 */
export async function bridgeUserToTwenty(
  _userId: string,
  _projectId: string,
): Promise<TwentyBridge> {
  throw new TwentyBridgeNotConfiguredError();
}
