import "server-only";

// PORT-NOTE: NestJS TypeOrmQueryService ported to plain exported async functions
// backed by MongoDB. DI-injected services (billing, feature flags, workspace manager,
// prefill, SDK client generation, etc.) must be provided by the caller.
// All Postgres-specific logic (schema creation/deletion, queryRunner transactions)
// is documented inline and must be re-implemented using MongoDB equivalents.

import { connectToDatabase } from "@/lib/mongodb";
import type { ActivateWorkspaceInput } from "@/lib/sabcrm/server/src/engine/core-modules/workspace/dtos/activate-workspace-input";
import type { UpdateWorkspaceInput } from "@/lib/sabcrm/server/src/engine/core-modules/workspace/dtos/update-workspace-input";

// Minimal workspace shape for Mongo documents
export type WorkspaceDoc = {
  id: string;
  displayName?: string | null;
  logo?: string | null;
  logoFileId?: string | null;
  inviteHash?: string | null;
  allowImpersonation: boolean;
  isPublicInviteLinkEnabled: boolean;
  trashRetentionDays?: number | null;
  eventLogRetentionDays?: number | null;
  activationStatus: string;
  metadataVersion: number;
  databaseSchema?: string | null;
  subdomain: string;
  customDomain?: string | null;
  isCustomDomainEnabled: boolean;
  isGoogleAuthEnabled: boolean;
  isGoogleAuthBypassEnabled: boolean;
  isTwoFactorAuthenticationEnforced: boolean;
  isPasswordAuthEnabled: boolean;
  isPasswordAuthBypassEnabled: boolean;
  isMicrosoftAuthEnabled: boolean;
  isMicrosoftAuthBypassEnabled: boolean;
  editableProfileFields?: string[] | null;
  defaultRoleId?: string | null;
  fastModel?: string | null;
  smartModel?: string | null;
  aiAdditionalInstructions?: string | null;
  enabledAiModelIds?: string[] | null;
  useRecommendedModels?: boolean | null;
  isInternalMessagesImportEnabled?: boolean | null;
  workspaceCustomApplicationId?: string | null;
  routerModel?: string | null;
  suspendedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

const WORKSPACE_COL = "sabcrm_workspace";
const USER_WORKSPACE_COL = "sabcrm_user_workspace";
const USER_COL = "sabcrm_user";

// PORT-NOTE: Permission validation against field map is preserved as a comment.
// In SabNode, permission checks run via the RBAC middleware before calling these functions.
// Field-level permissions from original WORKSPACE_FIELD_PERMISSIONS:
//   subdomain, customDomain, displayName, logo, trashRetentionDays -> WORKSPACE
//   eventLogRetentionDays -> SECURITY
//   inviteHash, isPublicInviteLinkEnabled, allowImpersonation -> WORKSPACE_MEMBERS / SECURITY
//   isGoogleAuthEnabled, isMicrosoftAuthEnabled, isPasswordAuthEnabled -> SECURITY
//   editableProfileFields, isTwoFactorAuthenticationEnforced -> SECURITY
//   defaultRoleId -> ROLES
//   fastModel, smartModel, aiAdditionalInstructions -> WORKSPACE
//   enabledAiModelIds, useRecommendedModels -> AI_SETTINGS
//   isInternalMessagesImportEnabled -> WORKSPACE

export async function updateWorkspaceById(
  workspaceId: string,
  payload: Partial<WorkspaceDoc>,
): Promise<WorkspaceDoc | null> {
  const db = await connectToDatabase();
  const col = db.collection<WorkspaceDoc>(WORKSPACE_COL);

  const workspace = await col.findOne({ id: workspaceId });

  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  const updated: Partial<WorkspaceDoc> = {
    ...payload,
    updatedAt: new Date(),
  };

  await col.updateOne({ id: workspaceId }, { $set: updated });

  return col.findOne({ id: workspaceId });
}

export async function activateWorkspace(
  userId: string,
  workspaceId: string,
  data: ActivateWorkspaceInput,
  // PORT-NOTE: workspaceManagerService.init, featureFlagService.enableFeatureFlags,
  // userWorkspaceService.createWorkspaceMember, prefillCreatedWorkspaceRecords,
  // and sdkClientGenerationService must be injected by the caller.
  deps: {
    initWorkspace: (workspaceId: string, userId: string) => Promise<void>;
    enableDefaultFeatureFlags: (workspaceId: string) => Promise<void>;
    createWorkspaceMember: (
      workspaceId: string,
      userId: string,
    ) => Promise<void>;
    prefillWorkspaceRecords?: (workspaceId: string) => Promise<void>;
  },
): Promise<WorkspaceDoc | null> {
  if (!data.displayName || !data.displayName.length) {
    throw new Error("'displayName' not provided");
  }

  const db = await connectToDatabase();
  const col = db.collection<WorkspaceDoc>(WORKSPACE_COL);

  const workspace = await col.findOne({ id: workspaceId });

  if (!workspace) throw new Error("Workspace not found");

  if (workspace.activationStatus === "ONGOING_CREATION") {
    throw new Error("Workspace is already being created");
  }

  if (workspace.activationStatus !== "PENDING_CREATION") {
    throw new Error("Workspace is not pending creation");
  }

  await col.updateOne(
    { id: workspaceId },
    { $set: { activationStatus: "ONGOING_CREATION", updatedAt: new Date() } },
  );

  await deps.initWorkspace(workspaceId, userId);
  await deps.enableDefaultFeatureFlags(workspaceId);
  await deps.createWorkspaceMember(workspaceId, userId);

  if (deps.prefillWorkspaceRecords) {
    await deps.prefillWorkspaceRecords(workspaceId);
  }

  await col.updateOne(
    { id: workspaceId },
    {
      $set: {
        displayName: data.displayName,
        activationStatus: "ACTIVE",
        updatedAt: new Date(),
      },
    },
  );

  return col.findOne({ id: workspaceId });
}

export async function suspendWorkspace(id: string): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection<WorkspaceDoc>(WORKSPACE_COL);

  await col.updateOne(
    { id },
    {
      $set: {
        activationStatus: "SUSPENDED",
        suspendedAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );
}

export async function deleteWorkspace(
  id: string,
  softDelete = false,
): Promise<WorkspaceDoc> {
  const db = await connectToDatabase();
  const col = db.collection<WorkspaceDoc>(WORKSPACE_COL);

  const workspace = await col.findOne({ id });

  if (!workspace) throw new Error("Workspace not found");

  const userWorkspaceCol = db.collection(USER_WORKSPACE_COL);
  const userWorkspaces = await userWorkspaceCol.find({ workspaceId: id }).toArray();

  for (const uw of userWorkspaces) {
    await handleRemoveWorkspaceMember(id, uw.userId as string, softDelete);
  }

  if (softDelete) {
    await col.updateOne(
      { id },
      { $set: { deletedAt: new Date(), updatedAt: new Date() } },
    );
    return workspace;
  }

  // PORT-NOTE: Workspace schema deletion (Postgres) has no Mongo equivalent.
  // Drop workspace-specific Mongo collections if per-workspace isolation is used.
  await col.deleteOne({ id });

  return workspace;
}

export async function handleRemoveWorkspaceMember(
  workspaceId: string,
  userId: string,
  softDelete = false,
): Promise<void> {
  const db = await connectToDatabase();
  const userWorkspaceCol = db.collection(USER_WORKSPACE_COL);
  const userCol = db.collection(USER_COL);

  const userWorkspaces = await userWorkspaceCol
    .find({ userId })
    .toArray();

  const targetUserWorkspace = userWorkspaces.find(
    (uw) => uw.workspaceId === workspaceId,
  );

  if (targetUserWorkspace) {
    if (softDelete) {
      await userWorkspaceCol.updateOne(
        { _id: targetUserWorkspace._id },
        { $set: { deletedAt: new Date() } },
      );
    } else {
      await userWorkspaceCol.deleteOne({ _id: targetUserWorkspace._id });
    }
  }

  const hasOtherUserWorkspaces = targetUserWorkspace
    ? userWorkspaces.length > 1
    : userWorkspaces.length > 0;

  if (!hasOtherUserWorkspaces) {
    await userCol.updateOne({ id: userId }, { $set: { deletedAt: new Date() } });
  }
}

export async function findOneWorkspaceById(
  id: string,
): Promise<WorkspaceDoc | null> {
  const db = await connectToDatabase();
  const col = db.collection<WorkspaceDoc>(WORKSPACE_COL);

  return col.findOne({ id });
}

// PORT-NOTE: updateWorkspaceById with UpdateWorkspaceInput (from resolver layer)
export async function updateWorkspaceSettings(
  workspaceId: string,
  input: UpdateWorkspaceInput,
): Promise<WorkspaceDoc | null> {
  return updateWorkspaceById(workspaceId, input as Partial<WorkspaceDoc>);
}
