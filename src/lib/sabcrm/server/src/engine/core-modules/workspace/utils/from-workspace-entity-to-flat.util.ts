import type { FlatWorkspace } from "@/lib/sabcrm/server/src/engine/core-modules/workspace/types/flat-workspace.type";

export type WorkspaceEntityLike = {
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
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt?: Date | string | null;
  suspendedAt?: Date | string | null;
};

export const fromWorkspaceEntityToFlat = (
  entity: WorkspaceEntityLike,
): FlatWorkspace => ({
  id: entity.id,
  displayName: entity.displayName,
  logo: entity.logo,
  logoFileId: entity.logoFileId,
  inviteHash: entity.inviteHash,
  allowImpersonation: entity.allowImpersonation,
  isPublicInviteLinkEnabled: entity.isPublicInviteLinkEnabled,
  trashRetentionDays: entity.trashRetentionDays,
  eventLogRetentionDays: entity.eventLogRetentionDays,
  activationStatus: entity.activationStatus,
  metadataVersion: entity.metadataVersion,
  databaseSchema: entity.databaseSchema,
  subdomain: entity.subdomain,
  customDomain: entity.customDomain,
  isGoogleAuthEnabled: entity.isGoogleAuthEnabled,
  isGoogleAuthBypassEnabled: entity.isGoogleAuthBypassEnabled,
  isTwoFactorAuthenticationEnforced: entity.isTwoFactorAuthenticationEnforced,
  isPasswordAuthEnabled: entity.isPasswordAuthEnabled,
  isPasswordAuthBypassEnabled: entity.isPasswordAuthBypassEnabled,
  isMicrosoftAuthEnabled: entity.isMicrosoftAuthEnabled,
  isMicrosoftAuthBypassEnabled: entity.isMicrosoftAuthBypassEnabled,
  isCustomDomainEnabled: entity.isCustomDomainEnabled,
  editableProfileFields: entity.editableProfileFields,
  defaultRoleId: entity.defaultRoleId,
  fastModel: entity.fastModel,
  smartModel: entity.smartModel,
  aiAdditionalInstructions: entity.aiAdditionalInstructions,
  enabledAiModelIds: entity.enabledAiModelIds,
  useRecommendedModels: entity.useRecommendedModels,
  isInternalMessagesImportEnabled: entity.isInternalMessagesImportEnabled,
  workspaceCustomApplicationId: entity.workspaceCustomApplicationId,
  routerModel: entity.routerModel,
  createdAt:
    entity.createdAt instanceof Date
      ? entity.createdAt.toISOString()
      : String(entity.createdAt),
  updatedAt:
    entity.updatedAt instanceof Date
      ? entity.updatedAt.toISOString()
      : String(entity.updatedAt),
  deletedAt:
    entity.deletedAt instanceof Date
      ? entity.deletedAt.toISOString()
      : entity.deletedAt ?? undefined,
  suspendedAt:
    entity.suspendedAt instanceof Date
      ? entity.suspendedAt.toISOString()
      : (entity.suspendedAt ?? null),
});
