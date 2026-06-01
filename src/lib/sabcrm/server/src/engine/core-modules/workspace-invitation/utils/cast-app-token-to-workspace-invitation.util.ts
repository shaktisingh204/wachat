import {
  WorkspaceInvitationException,
  WorkspaceInvitationExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/workspace-invitation/workspace-invitation.exception";

const INVITATION_TOKEN_TYPE = "InvitationToken";

export type AppTokenLike = {
  id: string;
  type: string;
  expiresAt: Date;
  context?: { email?: string; roleId?: string };
};

export const castAppTokenToWorkspaceInvitationUtil = (
  appToken: AppTokenLike,
) => {
  if (appToken.type !== INVITATION_TOKEN_TYPE) {
    throw new WorkspaceInvitationException(
      `Token type must be "${INVITATION_TOKEN_TYPE}"`,
      WorkspaceInvitationExceptionCode.INVALID_APP_TOKEN_TYPE,
    );
  }

  if (!appToken.context?.email) {
    throw new WorkspaceInvitationException(
      `Invitation corrupted: Missing email in context`,
      WorkspaceInvitationExceptionCode.INVITATION_CORRUPTED,
    );
  }

  return {
    id: appToken.id,
    email: appToken.context.email,
    roleId: appToken.context.roleId ?? null,
    expiresAt: appToken.expiresAt,
  };
};
