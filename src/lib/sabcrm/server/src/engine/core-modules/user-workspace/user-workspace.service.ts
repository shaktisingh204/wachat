import "server-only";

// PORT-NOTE: TypeORM-based UserWorkspaceService → plain exported async
// functions backed by MongoDB. NestJS DI removed. Heavy cross-module deps
// (OnboardingService, FileCorePictureService, etc.) are represented as
// injectable parameters or stubs where the call site must supply the
// implementation. Behaviors are preserved.

import { connectToDatabase } from "@/lib/mongodb";
import { type UserWorkspaceDocument } from "@/lib/sabcrm/server/src/engine/core-modules/user-workspace/user-workspace.entity";
import {
  UserWorkspaceException,
  UserWorkspaceExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/user-workspace/user-workspace.exception";

const COLLECTION = "sabcrm_user_workspace";
const USER_COLLECTION = "sabcrm_user";

async function col() {
  const { db } = await connectToDatabase();
  return db.collection<UserWorkspaceDocument>(COLLECTION);
}

// --------------------------------------------------------------------------
// Read helpers
// --------------------------------------------------------------------------

export async function findUserWorkspaceById(
  id: string,
): Promise<UserWorkspaceDocument | null> {
  const c = await col();
  return c.findOne({ _id: id } as Parameters<typeof c.findOne>[0]);
}

export async function checkUserWorkspaceExists(
  userId: string,
  workspaceId: string,
): Promise<UserWorkspaceDocument | null> {
  const c = await col();
  return c.findOne({ userId, workspaceId } as Parameters<typeof c.findOne>[0]);
}

export async function checkUserWorkspaceExistsByEmail(
  email: string,
  workspaceId: string,
): Promise<boolean> {
  const { db } = await connectToDatabase();
  const userCol = db.collection(USER_COLLECTION);
  const user = await userCol.findOne({ email }, { projection: { _id: 1 } });
  if (!user) return false;

  const c = await col();
  const exists = await c.countDocuments({ workspaceId, userId: String(user._id) });
  return exists > 0;
}

export async function getUserWorkspaceCount(workspaceId: string): Promise<number> {
  const c = await col();
  return c.countDocuments({ workspaceId });
}

export async function countUserWorkspaces(userId: string): Promise<number> {
  const c = await col();
  return c.countDocuments({ userId });
}

export async function getUserWorkspaceForUserOrThrow({
  userId,
  workspaceId,
}: {
  userId: string;
  workspaceId: string;
}): Promise<UserWorkspaceDocument> {
  const c = await col();
  const doc = await c.findOne({ userId, workspaceId } as Parameters<typeof c.findOne>[0]);

  if (!doc) {
    throw new UserWorkspaceException(
      "User workspace not found",
      UserWorkspaceExceptionCode.USER_WORKSPACE_NOT_FOUND,
    );
  }

  return doc;
}

export async function getActiveUserWorkspaceCountTotal(): Promise<number> {
  const c = await col();
  const count = await c.countDocuments({ deletedAt: null });
  return Math.max(1, count);
}

// --------------------------------------------------------------------------
// Mutation helpers
// --------------------------------------------------------------------------

export async function createUserWorkspace({
  userId,
  workspaceId,
  defaultAvatarUrl,
  locale = "en",
}: {
  userId: string;
  workspaceId: string;
  defaultAvatarUrl?: string | null;
  locale?: string;
}): Promise<UserWorkspaceDocument> {
  const c = await col();
  const now = new Date();
  const doc: UserWorkspaceDocument = {
    _id: crypto.randomUUID(),
    userId,
    workspaceId,
    defaultAvatarUrl: defaultAvatarUrl ?? null,
    locale,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await c.insertOne(doc as Parameters<typeof c.insertOne>[0]);
  return doc;
}

export async function updateUserWorkspaceLocale({
  locale,
  userWorkspaceId,
}: {
  locale: string;
  userWorkspaceId: string;
}): Promise<void> {
  const c = await col();
  await c.updateOne(
    { _id: userWorkspaceId } as Parameters<typeof c.updateOne>[0],
    { $set: { locale, updatedAt: new Date() } },
  );
}

export async function deleteUserWorkspace({
  userWorkspaceId,
  softDelete = false,
}: {
  userWorkspaceId: string;
  softDelete?: boolean;
}): Promise<void> {
  const c = await col();
  if (softDelete) {
    await c.updateOne(
      { _id: userWorkspaceId } as Parameters<typeof c.updateOne>[0],
      { $set: { deletedAt: new Date(), updatedAt: new Date() } },
    );
  } else {
    await c.deleteOne({ _id: userWorkspaceId } as Parameters<typeof c.deleteOne>[0]);
  }
}

// --------------------------------------------------------------------------
// Workspace discovery helpers
// --------------------------------------------------------------------------

export async function findFirstWorkspaceIdByUserId(
  userId: string,
): Promise<string | null> {
  const c = await col();
  const doc = await c.findOne(
    { userId } as Parameters<typeof c.findOne>[0],
    { sort: { createdAt: 1 }, projection: { workspaceId: 1 } },
  );
  return doc ? doc.workspaceId : null;
}
