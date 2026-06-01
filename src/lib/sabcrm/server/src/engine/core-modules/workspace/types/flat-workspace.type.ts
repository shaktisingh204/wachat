// PORT-NOTE: Original derives FlatWorkspace by omitting non-cached properties
// from WorkspaceEntity (TypeORM) and casting Date fields to string via a utility type.
// Ported as a concrete type whose Date fields are serialised to ISO strings.

export type FlatWorkspace = {
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
  // Dates serialised as ISO strings (matches CastRecordTypeOrmDatePropertiesToString)
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  suspendedAt?: string | null;
};
