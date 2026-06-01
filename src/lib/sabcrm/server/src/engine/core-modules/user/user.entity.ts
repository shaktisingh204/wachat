import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: TypeORM entity -> Mongo schema. OnboardingStatus enum from original.
export enum OnboardingStatus {
  SKIPPED_CREATE_WORKSPACE = "SKIPPED_CREATE_WORKSPACE",
  PLAN_REQUIRED = "PLAN_REQUIRED",
  WORKSPACE_ACTIVATION = "WORKSPACE_ACTIVATION",
  PROFILE_CREATION = "PROFILE_CREATION",
  SYNC_EMAIL = "SYNC_EMAIL",
  INVITE_TEAM = "INVITE_TEAM",
  COMPLETED = "COMPLETED",
}

export type UserDocument = {
  /** MongoDB _id stored as UUID string */
  _id: string;
  id: string;
  firstName: string;
  lastName: string;
  /** Normalised to lowercase on write */
  email: string;
  isEmailVerified: boolean;
  disabled: boolean;
  passwordHash?: string;
  canImpersonate: boolean;
  canAccessFullAdminPanel: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  /** BCP-47 locale code, default 'en' */
  locale: string;
  /** IDs of related AppToken documents */
  appTokenIds?: string[];
  /** IDs of related KeyValuePair documents */
  keyValuePairIds?: string[];
  /** IDs of related UserWorkspace documents */
  userWorkspaceIds?: string[];
  /** Virtual / resolved at query time — not stored */
  workspaceMember?: unknown;
  onboardingStatus?: OnboardingStatus;
  currentWorkspaceId?: string;
  currentUserWorkspaceId?: string;
};

export const SABCRM_USER_COLLECTION = "sabcrm_user";

export async function getUserCollection() {
  const { db } = await connectToDatabase();
  return db.collection<UserDocument>(SABCRM_USER_COLLECTION);
}

/** Ensure unique email index (partial: only where deletedAt is null) */
export async function ensureUserIndexes() {
  const col = await getUserCollection();
  await col.createIndex(
    { email: 1 },
    {
      unique: true,
      partialFilterExpression: { deletedAt: null },
      name: "UQ_USER_EMAIL",
    }
  );
}
