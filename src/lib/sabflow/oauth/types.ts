/**
 * Generic OAuth 2.0 provider descriptors + token shape.
 *
 * Each provider implements the `OAuthProvider` interface and registers
 * itself in `providers.ts`.  The credential store reads the provider id
 * back out of `credential.data.oauthProvider` to know how to refresh
 * expired tokens.
 *
 * Tokens are persisted under the credential's `data` bag:
 *   {
 *     oauthProvider: 'google',
 *     accessToken:  '...',
 *     refreshToken: '...',
 *     expiresAt:    '2026-12-01T00:00:00Z',
 *     scope:        'https://www.googleapis.com/auth/userinfo.email ...',
 *     tokenType:    'Bearer',
 *     idToken?:     '...'
 *   }
 */

export type OAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  /** ISO timestamp of expiry. */
  expiresAt?: string;
  scope?: string;
  tokenType?: string;
  idToken?: string;
};

export type OAuthProviderConfig = {
  /** OAuth client id (public). */
  clientId: string;
  /** OAuth client secret (server-side only). */
  clientSecret: string;
  /** Full callback URL — must match what's registered with the provider. */
  redirectUri: string;
};

export interface OAuthProvider {
  /** Stable id, e.g. "google".  Stored on the credential as `oauthProvider`. */
  id: string;
  /** Human label, e.g. "Google". */
  label: string;
  /** Default scopes — the user can add more in the authorise step. */
  defaultScopes: string[];

  /**
   * Build the authorise URL that the user visits in their browser.  The
   * provider appends the state nonce + the supplied scopes.
   */
  buildAuthorizeUrl(opts: {
    config: OAuthProviderConfig;
    state: string;
    scopes?: string[];
    extraParams?: Record<string, string>;
  }): string;

  /**
   * Exchange an authorisation code (from the callback) for tokens.  This
   * is one network round-trip to the provider's token endpoint.
   */
  exchangeCode(opts: {
    code: string;
    config: OAuthProviderConfig;
  }): Promise<OAuthTokens>;

  /**
   * Refresh an expired access token using a stored refresh token.  Throws
   * when the refresh token itself has expired or been revoked.
   */
  refreshAccessToken(opts: {
    refreshToken: string;
    config: OAuthProviderConfig;
  }): Promise<OAuthTokens>;
}
