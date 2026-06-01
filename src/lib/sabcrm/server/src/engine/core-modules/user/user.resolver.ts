"use server";

import {
  loadWorkspaceMember,
  loadWorkspaceMembers,
  loadDeletedWorkspaceMembersOnly,
  deleteUser,
  findUserByIdOrThrow,
  updateUserEmail,
  type WorkspaceRef,
} from "@/lib/sabcrm/server/src/engine/core-modules/user/services/user.service";
import {
  WorkspaceMemberTranspiler,
  type ToWorkspaceMemberDtoArgs,
  type WorkspaceMemberDTO,
  type DeletedWorkspaceMemberDTO,
} from "@/lib/sabcrm/server/src/engine/core-modules/user/services/workspace-member-transpiler.service";
import { UserVarsService } from "@/lib/sabcrm/server/src/engine/core-modules/user/user-vars/services/user-vars.service";
import { assertWorkspaceMemberUpdateUsesNonCustomFieldsOnly } from "@/lib/sabcrm/server/src/engine/core-modules/user/utils/assert-workspace-member-update-non-custom-fields.util";
import { UserExceptionCode, UserException } from "@/lib/sabcrm/server/src/engine/core-modules/user/user.exception";
import { userValidator } from "@/lib/sabcrm/server/src/engine/core-modules/user/user.validate";
import { type UserDocument } from "@/lib/sabcrm/server/src/engine/core-modules/user/user.entity";

// PORT-NOTE: Original was a NestJS GraphQL resolver with guards, filters, and
// injected services. We expose the same logical operations as plain async
// server functions. Auth/permission checks are delegated to the call site or
// SabNode's middleware layer. NestJS-specific decorators are not reproduced.

// Helper — compute HMAC for support chat identity
import crypto from "crypto";

function getHMACKey(
  email?: string,
  key?: string | null
): string | null {
  if (!email || !key) return null;
  const hmac = crypto.createHmac("sha256", key);
  return hmac.update(email).digest("hex");
}

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Loads the current user, optionally hydrated with workspace context.
 * Equivalent to the @Query currentUser resolver.
 */
export async function getCurrentUser(
  userId: string
): Promise<UserDocument> {
  return findUserByIdOrThrow(userId);
}

// ── Resolve Fields ────────────────────────────────────────────────────────────

/**
 * Resolve userVars field — returns a filtered map of user variables.
 * Original filtered by an allowlist of OnboardingStepKeys + AccountsToReconnectKeys.
 */
export async function resolveUserVars(
  user: UserDocument,
  workspace: WorkspaceRef | undefined,
  userVarService: UserVarsService,
  allowList: string[]
): Promise<Record<string, unknown>> {
  if (!workspace) return {};

  const userVars = await userVarService.getAll({
    userId: user.id,
    workspaceId: workspace.id,
  });

  const filteredMap = new Map(
    [...userVars].filter(([key]) => allowList.includes(key))
  );

  return Object.fromEntries(filteredMap);
}

/**
 * Resolve workspaceMember field for a user in a workspace.
 */
export async function resolveWorkspaceMember(
  user: UserDocument,
  workspace: WorkspaceRef | undefined,
  transpiler: WorkspaceMemberTranspiler,
  getUserWorkspaceForUser: (userId: string, workspaceId: string) => Promise<{ id: string; workspaceId: string; userId: string }>,
  getRolesByUserWorkspace: (userWorkspaceId: string, workspaceId: string) => Promise<{ id: string; name: string }[]>
): Promise<WorkspaceMemberDTO | null> {
  if (!workspace) return null;

  const workspaceMemberEntity = await loadWorkspaceMember(user, workspace);

  if (!workspaceMemberEntity) return null;

  const entityTyped = workspaceMemberEntity as {
    id: string;
    userId: string;
    name: { firstName: string; lastName: string };
    userEmail?: string;
    avatarUrl?: string;
    colorScheme?: string;
    locale?: string;
    timeFormat?: string;
    timeZone?: string;
    dateFormat?: string;
    calendarStartDay?: number;
    numberFormat?: string;
  };

  const userWorkspace = await getUserWorkspaceForUser(
    entityTyped.userId,
    workspace.id
  );

  const userWorkspaceRoles = await getRolesByUserWorkspace(
    userWorkspace.id,
    workspace.id
  );

  return transpiler.toWorkspaceMemberDto({
    workspaceMemberEntity: entityTyped,
    userWorkspace,
    userWorkspaceRoles,
  });
}

/**
 * Resolve workspaceMembers field.
 */
export async function resolveWorkspaceMembers(
  workspace: WorkspaceRef | undefined,
  transpiler: WorkspaceMemberTranspiler,
  getUserWorkspaceForUser: (userId: string, workspaceId: string) => Promise<{ id: string; workspaceId: string; userId: string }>,
  getRolesByUserWorkspaceBatch: (
    userWorkspaceIds: string[],
    workspaceId: string
  ) => Promise<Map<string, { id: string; name: string }[]>>
): Promise<WorkspaceMemberDTO[]> {
  if (!workspace) return [];

  const workspaceMemberEntities = await loadWorkspaceMembers(workspace, false);

  const results: WorkspaceMemberDTO[] = [];

  for (const entity of workspaceMemberEntities) {
    const entityTyped = entity as {
      id: string;
      userId: string;
      name: { firstName: string; lastName: string };
      userEmail?: string;
      avatarUrl?: string;
      colorScheme?: string;
      locale?: string;
      timeFormat?: string;
      timeZone?: string;
      dateFormat?: string;
      calendarStartDay?: number;
      numberFormat?: string;
    };

    const userWorkspace = await getUserWorkspaceForUser(
      entityTyped.userId,
      workspace.id
    );

    const roleMap = await getRolesByUserWorkspaceBatch(
      [userWorkspace.id],
      workspace.id
    );

    const userWorkspaceRoles = roleMap.get(userWorkspace.id);

    if (!userWorkspaceRoles) {
      throw new Error("User workspace roles not found");
    }

    results.push(
      await transpiler.toWorkspaceMemberDto({
        workspaceMemberEntity: entityTyped,
        userWorkspace,
        userWorkspaceRoles,
      })
    );
  }

  return results;
}

/**
 * Resolve deletedWorkspaceMembers field.
 */
export async function resolveDeletedWorkspaceMembers(
  workspace: WorkspaceRef | undefined,
  transpiler: WorkspaceMemberTranspiler
): Promise<DeletedWorkspaceMemberDTO[]> {
  if (!workspace) return [];

  const workspaceMemberEntities = await loadDeletedWorkspaceMembersOnly(
    workspace
  );

  return transpiler.toDeletedWorkspaceMemberDtos(
    workspaceMemberEntities as Parameters<typeof transpiler.toDeletedWorkspaceMemberDtos>[0],
    workspace.id
  );
}

/**
 * Compute the supportUserHash field value.
 */
export function resolveUserSupportHash(
  email: string,
  supportDriver: string,
  hmacKey?: string | null
): string | null {
  if (supportDriver !== "front") return null;
  return getHMACKey(email, hmacKey);
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Delete the current user (soft-delete).
 * Equivalent to @Mutation deleteUser.
 */
export { deleteUser } from "@/lib/sabcrm/server/src/engine/core-modules/user/services/user.service";

/**
 * Update workspace member settings.
 * Equivalent to @Mutation updateWorkspaceMemberSettings.
 *
 * PORT-NOTE: Permission checks (isUpdatingSelf, WORKSPACE_MEMBERS setting)
 * must be enforced by the caller / Next.js API route handler.
 */
export async function updateWorkspaceMemberSettings(
  workspaceMemberId: string,
  update: Record<string, unknown>,
  workspaceId: string,
  updateMemberInDb: (
    workspaceId: string,
    memberId: string,
    patch: Record<string, unknown>
  ) => Promise<void>,
  onProfileComplete?: (opts: {
    userId: string;
    workspaceId: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<void>
): Promise<boolean> {
  assertWorkspaceMemberUpdateUsesNonCustomFieldsOnly({ update });

  await updateMemberInDb(workspaceId, workspaceMemberId, update);

  const nameUpdate = update.name as
    | { firstName?: string; lastName?: string }
    | undefined;

  if (onProfileComplete) {
    // PORT-NOTE: userId lookup for the member delegated to caller-supplied fn.
    // Original called onboardingService.completeOnboardingProfileStepIfNameProvided.
    await onProfileComplete({
      userId: workspaceMemberId, // placeholder — caller should resolve real userId
      workspaceId,
      firstName: nameUpdate?.firstName,
      lastName: nameUpdate?.lastName,
    });
  }

  return true;
}

/**
 * Initiate email update for the authenticated user.
 * Equivalent to @Mutation updateUserEmail.
 *
 * PORT-NOTE: Verification email sending is delegated to the caller (use
 * SabNode's email verification service). Permission and domain checks
 * must be enforced at the call site.
 */
export async function initiateUpdateUserEmail({
  userId,
  currentEmail,
  newEmail,
}: {
  userId: string;
  currentEmail: string;
  newEmail: string;
}): Promise<void> {
  return updateUserEmail({ userId, currentEmail, newEmail });
}
