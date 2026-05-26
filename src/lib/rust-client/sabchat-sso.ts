/**
 * Client for `/v1/sabchat/sso/*` — SSO configuration CRUD + SCIM token
 * management. Owned by the `sabchat-sso` Rust crate. The companion SCIM
 * 2.0 surface (`/v1/sabchat/scim/v2/*`) is consumed by external identity
 * providers (Okta, Azure AD, JumpCloud) and is therefore *not* wrapped
 * here — those calls authenticate with a Bearer SCIM token, never with
 * the SabNode session JWT this fetcher mints.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type SabChatSsoProvider = 'saml' | 'oidc';

export interface SabChatSsoConfig {
    _id: string;
    tenantId: string;
    provider: SabChatSsoProvider;
    enabled: boolean;
    domain?: string;
    metadataUrl?: string;
    metadataXml?: string;
    clientId?: string;
    issuer?: string;
    authorizationEndpoint?: string;
    tokenEndpoint?: string;
    jwksUri?: string;
    defaultRole?: string;
    createdAt: string;
    updatedAt: string;
}

export interface SabChatScimToken {
    _id: string;
    tenantId: string;
    label: string;
    tokenLast4?: string;
    token?: string; // only returned at creation time
    lastUsedAt?: string;
    createdAt: string;
}

export const sabchatSsoApi = {
    listConfigs: () => rustFetch<{ items: SabChatSsoConfig[] }>('/v1/sabchat/sso/configs'),

    createConfig: (body: Partial<Omit<SabChatSsoConfig, '_id' | 'tenantId' | 'createdAt' | 'updatedAt'>> & { provider: SabChatSsoProvider }) =>
        rustFetch<SabChatSsoConfig>('/v1/sabchat/sso/configs', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    getConfig: (id: string) => rustFetch<SabChatSsoConfig>(`/v1/sabchat/sso/configs/${id}`),

    updateConfig: (id: string, body: Partial<Omit<SabChatSsoConfig, '_id' | 'tenantId' | 'createdAt' | 'updatedAt'>>) =>
        rustFetch<SabChatSsoConfig>(`/v1/sabchat/sso/configs/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    deleteConfig: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/sso/configs/${id}`, { method: 'DELETE' }),

    listScimTokens: () => rustFetch<{ items: SabChatScimToken[] }>('/v1/sabchat/sso/scim-tokens'),

    createScimToken: (body: { label: string }) =>
        rustFetch<SabChatScimToken>('/v1/sabchat/sso/scim-tokens', {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    revokeScimToken: (id: string) =>
        rustFetch<{ message: string }>(`/v1/sabchat/sso/scim-tokens/${id}`, { method: 'DELETE' }),
};
