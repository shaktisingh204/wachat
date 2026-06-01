import "server-only";

import { connectToDatabase } from "@/lib/mongodb";
import { type UserDocument, getUserCollection } from "@/lib/sabcrm/server/src/engine/core-modules/user/user.entity";
import {
  UserException,
  UserExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/user/user.exception";
import { userValidator } from "@/lib/sabcrm/server/src/engine/core-modules/user/user.validate";
import { invalidateCachedUser } from "@/lib/sabcrm/server/src/engine/core-modules/user/services/user-entity-cache-provider.service";
import { WorkspaceMemberTranspiler } from "@/lib/sabcrm/server/src/engine/core-modules/user/services/workspace-member-transpiler.service";

// PORT-NOTE: Original extended TypeOrmQueryService<UserEntity> with NestJS DI
// and used TypeORM repository + GlobalWorkspaceOrmManager. We replace TypeORM
// with Mongo collection calls. Cross-workspace member queries that originally
// used globalWorkspaceOrmManager are documented below with PORT-NOTEs.

export type WorkspaceRef = {
  id: string;
  activationStatus: string;
};

const ACTIVE_STATUSES = new Set(["ACTIVE", "SUSPENDED"]);

function isWorkspaceActiveOrSuspended(workspace: WorkspaceRef): boolean {
  return ACTIVE_STATUSES.has(workspace.activationStatus);
}

async function getWorkspaceMemberCollection(workspaceId: string) {
  const { db } = await connectToDatabase();
  return db.collection(`sabcrm_workspace_member_${workspaceId}`);
}

export async function loadWorkspaceMember(
  user: { id: string },
  workspace: WorkspaceRef
): Promise<Record<string, unknown> | null> {
  if (!isWorkspaceActiveOrSuspended(workspace)) return null;

  // PORT-NOTE: Originally called globalWorkspaceOrmManager.getRepository.
  const col = await getWorkspaceMemberCollection(workspace.id);
  return col.findOne({ userId: user.id }) as Promise<Record<string, unknown> | null>;
}

export async function loadWorkspaceMembers(
  workspace: WorkspaceRef,
  withDeleted = false
): Promise<Record<string, unknown>[]> {
  if (!isWorkspaceActiveOrSuspended(workspace)) return [];

  const col = await getWorkspaceMemberCollection(workspace.id);
  const filter = withDeleted ? {} : { deletedAt: null };
  return col.find(filter).toArray() as Promise<Record<string, unknown>[]>;
}

export async function loadDeletedWorkspaceMembersOnly(
  workspace: WorkspaceRef
): Promise<Record<string, unknown>[]> {
  if (!isWorkspaceActiveOrSuspended(workspace)) return [];

  const col = await getWorkspaceMemberCollection(workspace.id);
  return col
    .find({ deletedAt: { $ne: null } })
    .toArray() as Promise<Record<string, unknown>[]>;
}

export async function loadWorkspaceMembersByUserIds({
  workspace,
  userIds,
}: {
  workspace: WorkspaceRef;
  userIds: string[];
}): Promise<Record<string, unknown>[]> {
  if (!isWorkspaceActiveOrSuspended(workspace) || userIds.length === 0) {
    return [];
  }

  const col = await getWorkspaceMemberCollection(workspace.id);
  return col
    .find(
      { userId: { $in: userIds } },
      { projection: { id: 1, userId: 1, avatarUrl: 1 } }
    )
    .toArray() as Promise<Record<string, unknown>[]>;
}

export async function loadSignedAvatarUrlsByUserId({
  workspace,
  fallbackAvatarUrlsByUserId,
  transpiler,
}: {
  workspace: WorkspaceRef;
  fallbackAvatarUrlsByUserId: Map<string, string | null>;
  transpiler: WorkspaceMemberTranspiler;
}): Promise<Map<string, string | null>> {
  const userIds = Array.from(fallbackAvatarUrlsByUserId.keys());

  if (userIds.length === 0) return new Map();

  const workspaceMembers = await loadWorkspaceMembersByUserIds({
    workspace,
    userIds,
  });

  const memberByUserId = new Map(
    workspaceMembers.map((m) => [(m as { userId: string }).userId, m])
  );

  const entries = await Promise.all(
    userIds.map(async (userId): Promise<[string, string | null]> => {
      const member = memberByUserId.get(userId) as
        | { avatarUrl?: string; id: string; userId: string }
        | undefined;

      const memberSigned = member
        ? await transpiler.generateSignedAvatarUrl({
            workspaceId: workspace.id,
            workspaceMember: { avatarUrl: member.avatarUrl, id: member.id },
          })
        : "";

      if (memberSigned) return [userId, memberSigned];

      const fallbackAvatarUrl = fallbackAvatarUrlsByUserId.get(userId);

      if (!fallbackAvatarUrl) return [userId, null];

      const fallbackSigned = await transpiler.generateSignedAvatarUrl({
        workspaceId: workspace.id,
        workspaceMember: { avatarUrl: fallbackAvatarUrl, id: userId },
      });

      return [userId, fallbackSigned || fallbackAvatarUrl];
    })
  );

  return new Map(entries);
}

export async function deleteUser(userId: string): Promise<UserDocument | null> {
  const col = await getUserCollection();

  const user = await col.findOne({ id: userId, deletedAt: null });

  userValidator.assertIsDefinedOrThrow(
    user ?? undefined,
    new UserException("User not found", UserExceptionCode.USER_NOT_FOUND)
  );

  // PORT-NOTE: Original iterated userWorkspaces and called
  // removeUserFromWorkspaceAndPotentiallyDeleteWorkspace for each.
  // That cross-workspace deletion logic requires WorkspaceService +
  // UserWorkspaceService which are ported separately.
  // Here we soft-delete the user record and invalidate the cache.

  await col.updateOne(
    { id: userId },
    { $set: { deletedAt: new Date(), updatedAt: new Date() } }
  );

  invalidateCachedUser(userId);

  return col.findOne({ id: userId }) as Promise<UserDocument | null>;
}

export async function findUserByEmail(
  email: string
): Promise<UserDocument | null> {
  const col = await getUserCollection();
  return col.findOne({ email: email.toLowerCase(), deletedAt: null }) as Promise<UserDocument | null>;
}

export async function findUserByEmailOrThrow(
  email: string,
  error?: Error
): Promise<UserDocument> {
  const user = await findUserByEmail(email);

  if (!user) {
    throw error ?? new UserException("User not found", UserExceptionCode.USER_NOT_FOUND);
  }

  return user;
}

export async function findUserByEmailWithWorkspaces(
  email: string
): Promise<UserDocument | null> {
  // PORT-NOTE: Original used TypeORM relations. Workspace IDs are stored on the
  // userWorkspaceIds array field in the Mongo document; full hydration done at call site.
  const col = await getUserCollection();
  return col.findOne({ email: email.toLowerCase(), deletedAt: null }) as Promise<UserDocument | null>;
}

export async function findUserById(id: string): Promise<UserDocument | null> {
  const col = await getUserCollection();
  return col.findOne({ id, deletedAt: null }) as Promise<UserDocument | null>;
}

export async function findUserByIdOrThrow(
  id: string,
  error?: Error
): Promise<UserDocument> {
  const user = await findUserById(id);

  if (!user) {
    throw error ?? new UserException("User not found", UserExceptionCode.USER_NOT_FOUND);
  }

  return user;
}

export async function markEmailAsVerified(
  userId: string
): Promise<UserDocument> {
  const col = await getUserCollection();

  await col.updateOne(
    { id: userId },
    { $set: { isEmailVerified: true, updatedAt: new Date() } }
  );

  return findUserByIdOrThrow(userId);
}

export async function updateEmailFromVerificationToken(
  userId: string,
  email: string
): Promise<UserDocument> {
  const col = await getUserCollection();

  await col.updateOne(
    { id: userId },
    { $set: { email: email.toLowerCase(), updatedAt: new Date() } }
  );

  // PORT-NOTE: Original enqueued UpdateWorkspaceMemberEmailJob via BullMQ.
  // Callers should enqueue that job separately via SabNode's queue layer.

  return findUserByIdOrThrow(userId);
}

export async function updateUserEmail({
  userId,
  currentEmail,
  newEmail,
}: {
  userId: string;
  currentEmail: string;
  newEmail: string;
}): Promise<void> {
  const normalizedEmail = newEmail.trim().toLowerCase();

  if (normalizedEmail === currentEmail.toLowerCase()) {
    throw new UserException(
      "New email must be different from current email",
      UserExceptionCode.EMAIL_UNCHANGED
    );
  }

  const col = await getUserCollection();

  const existingUser = await col.findOne({
    email: normalizedEmail,
    deletedAt: null,
  });

  if (existingUser && (existingUser as UserDocument).id !== userId) {
    throw new UserException(
      "Email already in use",
      UserExceptionCode.EMAIL_ALREADY_IN_USE
    );
  }

  // PORT-NOTE: Original validated single-workspace constraint via
  // userWorkspaceService.countUserWorkspaces and sent a verification email.
  // Those steps are delegated to the caller / action layer.
}

export async function hasUserAccessToWorkspaceOrThrow(
  userId: string,
  workspaceId: string
): Promise<void> {
  const col = await getUserCollection();

  const user = await col.findOne({
    id: userId,
    userWorkspaceIds: workspaceId,
    deletedAt: null,
  });

  if (!user) {
    throw new UserException(
      "User does not have access to this workspace",
      UserExceptionCode.USER_NOT_FOUND
    );
  }
}
