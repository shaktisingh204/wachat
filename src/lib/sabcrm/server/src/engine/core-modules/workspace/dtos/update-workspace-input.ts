const DOMAIN_PATTERN =
  /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/;

export type UpdateWorkspaceInput = {
  subdomain?: string;
  /** Must match a valid hostname pattern */
  customDomain?: string;
  displayName?: string;
  logo?: string;
  inviteHash?: string;
  isPublicInviteLinkEnabled?: boolean;
  allowImpersonation?: boolean;
  isGoogleAuthEnabled?: boolean;
  isMicrosoftAuthEnabled?: boolean;
  isPasswordAuthEnabled?: boolean;
  isGoogleAuthBypassEnabled?: boolean;
  isMicrosoftAuthBypassEnabled?: boolean;
  isPasswordAuthBypassEnabled?: boolean;
  defaultRoleId?: string;
  isTwoFactorAuthenticationEnforced?: boolean;
  trashRetentionDays?: number;
  /** Min: 30, Max: 1095 */
  eventLogRetentionDays?: number;
  fastModel?: string;
  smartModel?: string;
  aiAdditionalInstructions?: string;
  editableProfileFields?: string[];
  enabledAiModelIds?: string[];
  useRecommendedModels?: boolean;
  isInternalMessagesImportEnabled?: boolean;
};

export function isValidCustomDomain(domain: string): boolean {
  return DOMAIN_PATTERN.test(domain);
}
