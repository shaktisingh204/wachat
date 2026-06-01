import type { WorkspaceUrlsDTO } from "@/lib/sabcrm/server/src/engine/core-modules/workspace/dtos/workspace-urls.dto";

// PORT-NOTE: IdentityProviderType and SSOIdentityProviderStatus are inlined here
// since the SSO entity module is ported separately.

export type IdentityProviderType = "OIDC" | "SAML";

export type SSOIdentityProviderStatus = "ACTIVE" | "INACTIVE" | "ERROR";

export type SSOIdentityProviderDTO = {
  id: string;
  name: string;
  type: IdentityProviderType;
  status: SSOIdentityProviderStatus;
  issuer: string;
};

export type AuthProvidersDTO = {
  sso: SSOIdentityProviderDTO[];
  google: boolean;
  magicLink: boolean;
  password: boolean;
  microsoft: boolean;
};

export type AuthBypassProvidersDTO = {
  google: boolean;
  password: boolean;
  microsoft: boolean;
};

export type PublicWorkspaceDataDTO = {
  id: string;
  authProviders: AuthProvidersDTO;
  authBypassProviders?: AuthBypassProvidersDTO;
  logo?: string | null;
  displayName?: string | null;
  workspaceUrls: WorkspaceUrlsDTO;
};

export type PublicWorkspaceDataSummaryDTO = {
  id: string;
  logo?: string | null;
  displayName?: string | null;
};
