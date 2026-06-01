import "server-only";

// PORT-NOTE: NestJS GraphQL resolver ported to plain exported async functions.
// Guard: WorkspaceAuthGuard + SettingsPermissionGuard(WORKSPACE_MEMBERS).
// UserAuthGuard required for resendWorkspaceInvitation and sendInvitations.
// Callers must verify workspace membership and WORKSPACE_MEMBERS permission.

import type { SendInvitationsDTO } from "@/lib/sabcrm/server/src/engine/core-modules/workspace-invitation/dtos/send-invitations.dto";
import type { WorkspaceInvitation } from "@/lib/sabcrm/server/src/engine/core-modules/workspace-invitation/dtos/workspace-invitation.dto";
import type { SendInvitationsInput } from "@/lib/sabcrm/server/src/engine/core-modules/workspace-invitation/dtos/send-invitations.input";
import {
  deleteWorkspaceInvitation,
  loadWorkspaceInvitations,
  resendWorkspaceInvitation,
  sendInvitations,
  type WorkspaceDoc,
  type WorkspaceMemberDoc,
} from "@/lib/sabcrm/server/src/engine/core-modules/workspace-invitation/services/workspace-invitation.service";

export async function deleteWorkspaceInvitationAction(
  appTokenId: string,
  workspaceId: string,
): Promise<"success" | "error"> {
  return deleteWorkspaceInvitation(appTokenId, workspaceId);
}

export async function resendWorkspaceInvitationAction(
  appTokenId: string,
  workspace: WorkspaceDoc,
  workspaceMember: WorkspaceMemberDoc,
): Promise<SendInvitationsDTO> {
  return resendWorkspaceInvitation(appTokenId, workspace, workspaceMember);
}

export async function findWorkspaceInvitationsAction(
  workspaceId: string,
): Promise<WorkspaceInvitation[]> {
  return loadWorkspaceInvitations(workspaceId);
}

export async function sendInvitationsAction(
  input: SendInvitationsInput,
  workspace: WorkspaceDoc,
  workspaceMember: WorkspaceMemberDoc,
): Promise<SendInvitationsDTO> {
  return sendInvitations(
    input.emails,
    workspace,
    workspaceMember,
    input.roleId ?? undefined,
  );
}
