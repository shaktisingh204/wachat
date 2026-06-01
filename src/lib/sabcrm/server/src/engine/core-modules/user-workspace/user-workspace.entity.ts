import "server-only";

import { connectToDatabase } from "@/lib/mongodb";
import { type Collection } from "mongodb";

// PORT-NOTE: TypeORM @Entity(userWorkspace) → Mongo collection sabcrm_user_workspace.
// Relations preserved as id-ref fields + inline metadata comments.

export type PermissionFlagType = string;
export type ObjectPermissionDTO = Record<string, unknown>;
export type TwoFactorAuthenticationMethodSummaryDTO = Record<string, unknown>;

// Source locale default matches twenty-shared SOURCE_LOCALE ('en')
const SOURCE_LOCALE = "en";

export type UserWorkspaceDocument = {
  _id: string;           // PrimaryGeneratedColumn('uuid') → MongoDB _id
  // Relation: ManyToOne → UserEntity (user-workspace.entity userId column)
  userId: string;
  workspaceId: string;   // Inherited from WorkspaceRelatedEntity
  defaultAvatarUrl?: string | null;
  locale: string;        // default: SOURCE_LOCALE
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;

  // Virtual/computed — stored as arrays in document when present
  // Relation: OneToMany → TwoFactorAuthenticationMethodEntity[]
  twoFactorAuthenticationMethodIds?: string[];
  permissionFlags?: PermissionFlagType[];
  objectPermissions?: ObjectPermissionDTO[];
  objectsPermissions?: ObjectPermissionDTO[];
  twoFactorAuthenticationMethodSummary?: TwoFactorAuthenticationMethodSummaryDTO[];
};

let _collection: Collection<UserWorkspaceDocument> | null = null;

export async function getUserWorkspaceCollection(): Promise<Collection<UserWorkspaceDocument>> {
  if (_collection) return _collection;
  const { db } = await connectToDatabase();
  _collection = db.collection<UserWorkspaceDocument>("sabcrm_user_workspace");
  return _collection;
}

// Indexes to create on first setup:
// { userId: 1, workspaceId: 1 } unique (partial: deletedAt null)  — IDX_USER_WORKSPACE_USER_ID_WORKSPACE_ID_UNIQUE
// { userId: 1 }                                                    — IDX_USER_WORKSPACE_USER_ID
// { workspaceId: 1 }                                               — IDX_USER_WORKSPACE_WORKSPACE_ID
export async function ensureUserWorkspaceIndexes(): Promise<void> {
  const col = await getUserWorkspaceCollection();
  await col.createIndexes([
    {
      key: { userId: 1, workspaceId: 1 },
      unique: true,
      partialFilterExpression: { deletedAt: null },
      name: "IDX_USER_WORKSPACE_USER_ID_WORKSPACE_ID_UNIQUE",
    },
    { key: { userId: 1 }, name: "IDX_USER_WORKSPACE_USER_ID" },
    { key: { workspaceId: 1 }, name: "IDX_USER_WORKSPACE_WORKSPACE_ID" },
  ]);
}
