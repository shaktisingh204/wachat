import "server-only";

import crypto from "crypto";

import { addMilliseconds } from "date-fns";
import ms from "ms";

import { connectToDatabase } from "@/lib/mongodb";
import type { SendInvitationsDTO } from "@/lib/sabcrm/server/src/engine/core-modules/workspace-invitation/dtos/send-invitations.dto";
import { castAppTokenToWorkspaceInvitationUtil } from "@/lib/sabcrm/server/src/engine/core-modules/workspace-invitation/utils/cast-app-token-to-workspace-invitation.util";
import {
  WorkspaceInvitationException,
  WorkspaceInvitationExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/workspace-invitation/workspace-invitation.exception";

// PORT-NOTE: NestJS DI replaced with plain exported async functions.
// Email sending, onboarding, throttling, and i18n dependencies must be injected
// by the caller or wrapped at the Next.js action layer.
// AppToken and UserWorkspace collections are accessed via Mongo.

export type AppTokenDoc = {
  _id: string;
  id: string;
  workspaceId: string;
  expiresAt: Date;
  type: string;
  value: string;
  context?: { email?: string; roleId?: string };
  deletedAt?: Date | null;
};

export type WorkspaceDoc = {
  id: string;
  inviteHash?: string;
  displayName?: string;
  logoFileId?: string;
  [key: string]: unknown;
};

export type WorkspaceMemberDoc = {
  userId: string;
  userEmail?: string;
  name: { firstName: string; lastName: string };
  locale?: string;
};

const APP_TOKEN_INVITATION = "InvitationToken";
const SABCRM_APP_TOKENS = "sabcrm_app_token";
const SABCRM_USER_WORKSPACES = "sabcrm_user_workspace";

export async function validatePersonalInvitation({
  workspacePersonalInviteToken,
  email,
}: {
  workspacePersonalInviteToken?: string;
  email: string;
}): Promise<{ isValid: boolean; workspace: WorkspaceDoc }> {
  const db = await connectToDatabase();
  const col = db.collection<AppTokenDoc>(SABCRM_APP_TOKENS);

  const appToken = await col.findOne({
    value: workspacePersonalInviteToken,
    type: APP_TOKEN_INVITATION,
  });

  if (!appToken) throw new Error("Invalid invitation token");
  if (!appToken.context?.email || appToken.context.email !== email) {
    throw new Error("Email does not match the invitation");
  }
  if (new Date(appToken.expiresAt) < new Date()) {
    throw new Error("Invitation expired");
  }

  // PORT-NOTE: workspace relation fetched from workspaces collection here
  const workspaceCol = db.collection<WorkspaceDoc>("sabcrm_workspace");
  const workspace = await workspaceCol.findOne({ id: appToken.workspaceId });

  if (!workspace) throw new Error("Workspace not found");

  return { isValid: true, workspace };
}

export async function findInvitationsByEmail(email: string): Promise<AppTokenDoc[]> {
  const db = await connectToDatabase();
  const col = db.collection<AppTokenDoc>(SABCRM_APP_TOKENS);

  return col
    .find({
      type: APP_TOKEN_INVITATION,
      "context.email": email,
      deletedAt: null,
      expiresAt: { $gt: new Date() },
    })
    .toArray();
}

export async function getOneWorkspaceInvitation(
  workspaceId: string,
  email: string,
): Promise<AppTokenDoc | null> {
  const db = await connectToDatabase();
  const col = db.collection<AppTokenDoc>(SABCRM_APP_TOKENS);

  return col.findOne({
    workspaceId,
    type: APP_TOKEN_INVITATION,
    "context.email": email,
  });
}

export async function getAppTokenByInvitationToken(
  invitationToken: string,
): Promise<AppTokenDoc> {
  const db = await connectToDatabase();
  const col = db.collection<AppTokenDoc>(SABCRM_APP_TOKENS);

  const appToken = await col.findOne({
    value: invitationToken,
    type: APP_TOKEN_INVITATION,
  });

  if (!appToken) {
    throw new WorkspaceInvitationException(
      "Invalid invitation token",
      WorkspaceInvitationExceptionCode.INVALID_INVITATION,
    );
  }

  return appToken;
}

export async function loadWorkspaceInvitations(workspaceId: string) {
  const db = await connectToDatabase();
  const col = db.collection<AppTokenDoc>(SABCRM_APP_TOKENS);

  const appTokens = await col
    .find({
      workspaceId,
      type: APP_TOKEN_INVITATION,
      deletedAt: null,
    })
    .project({ value: 0 })
    .toArray();

  return appTokens.map((t) => castAppTokenToWorkspaceInvitationUtil(t as AppTokenDoc));
}

export async function generateInvitationToken(
  workspaceId: string,
  email: string,
  roleId?: string,
  invitationTokenExpiresIn = "1d",
): Promise<AppTokenDoc> {
  const db = await connectToDatabase();
  const col = db.collection<AppTokenDoc>(SABCRM_APP_TOKENS);

  const expiresAt = addMilliseconds(
    new Date().getTime(),
    ms(invitationTokenExpiresIn),
  );

  const newToken: AppTokenDoc = {
    _id: crypto.randomUUID(),
    id: crypto.randomUUID(),
    workspaceId,
    expiresAt,
    type: APP_TOKEN_INVITATION,
    value: crypto.randomBytes(32).toString("hex"),
    context: {
      email,
      ...(roleId !== undefined ? { roleId } : {}),
    },
  };

  await col.insertOne(newToken);

  return newToken;
}

export async function createWorkspaceInvitation(
  email: string,
  workspaceId: string,
  roleId?: string,
): Promise<AppTokenDoc> {
  const db = await connectToDatabase();
  const userWorkspaceCol = db.collection(SABCRM_USER_WORKSPACES);

  const maybeExisting = await getOneWorkspaceInvitation(
    workspaceId,
    email.toLowerCase(),
  );

  if (maybeExisting) {
    throw new WorkspaceInvitationException(
      `${email} already invited`,
      WorkspaceInvitationExceptionCode.INVITATION_ALREADY_EXIST,
    );
  }

  const isUserAlreadyInWorkspace = await userWorkspaceCol.findOne({
    workspaceId,
    userEmail: email,
  });

  if (isUserAlreadyInWorkspace) {
    throw new WorkspaceInvitationException(
      `${email} is already in the workspace`,
      WorkspaceInvitationExceptionCode.USER_ALREADY_EXIST,
    );
  }

  return generateInvitationToken(workspaceId, email, roleId);
}

export async function deleteWorkspaceInvitation(
  appTokenId: string,
  workspaceId: string,
): Promise<"success" | "error"> {
  const db = await connectToDatabase();
  const col = db.collection<AppTokenDoc>(SABCRM_APP_TOKENS);

  const appToken = await col.findOne({
    id: appTokenId,
    workspaceId,
    type: APP_TOKEN_INVITATION,
  });

  if (!appToken) return "error";

  await col.deleteOne({ id: appTokenId });

  return "success";
}

export async function invalidateWorkspaceInvitation(
  workspaceId: string,
  email: string,
): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection<AppTokenDoc>(SABCRM_APP_TOKENS);

  const appToken = await getOneWorkspaceInvitation(workspaceId, email);

  if (!appToken) return;

  await col.deleteOne({ id: appToken.id });
}

// PORT-NOTE: sendInvitations email sending (React Email + nodemailer/resend) and
// onboarding state updates must be integrated at the Next.js action layer.
// This function handles invitation record creation and returns results.
export async function sendInvitations(
  emails: string[],
  workspace: WorkspaceDoc,
  _sender: WorkspaceMemberDoc,
  roleId?: string,
): Promise<SendInvitationsDTO> {
  if (!workspace.inviteHash) {
    return {
      success: false,
      errors: ["Workspace invite hash not found"],
      result: [],
    };
  }

  const invitationResults = await Promise.allSettled(
    emails.map(async (email) => {
      const appToken = await createWorkspaceInvitation(
        email,
        workspace.id,
        roleId,
      );

      if (!appToken.context?.email) {
        throw new WorkspaceInvitationException(
          "Invalid email",
          WorkspaceInvitationExceptionCode.EMAIL_MISSING,
        );
      }

      return { appToken, email: appToken.context.email };
    }),
  );

  const result = invitationResults.reduce<{
    errors: string[];
    result: ReturnType<typeof castAppTokenToWorkspaceInvitationUtil>[];
  }>(
    (acc, invitation) => {
      if (invitation.status === "rejected") {
        acc.errors.push(invitation.reason?.message ?? "Unknown error");
      } else {
        acc.result.push(
          castAppTokenToWorkspaceInvitationUtil(invitation.value.appToken),
        );
      }

      return acc;
    },
    { errors: [], result: [] },
  );

  return {
    success: result.errors.length === 0,
    ...result,
  };
}

export async function resendWorkspaceInvitation(
  appTokenId: string,
  workspace: WorkspaceDoc,
  sender: WorkspaceMemberDoc,
): Promise<SendInvitationsDTO> {
  const db = await connectToDatabase();
  const col = db.collection<AppTokenDoc>(SABCRM_APP_TOKENS);

  const appToken = await col.findOne({
    id: appTokenId,
    workspaceId: workspace.id,
    type: APP_TOKEN_INVITATION,
  });

  if (!appToken || !appToken.context?.email) {
    throw new WorkspaceInvitationException(
      "Invalid appToken",
      WorkspaceInvitationExceptionCode.INVALID_INVITATION,
    );
  }

  await col.deleteOne({ id: appTokenId });

  return sendInvitations(
    [appToken.context.email],
    workspace,
    sender,
    appToken.context.roleId,
  );
}
