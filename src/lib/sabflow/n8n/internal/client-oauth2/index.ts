/**
 * Minimal sabflow stub for `@n8n/client-oauth2`.
 *
 * Until OAuth credential flows are exercised end-to-end, we expose a
 * structurally-typed `ClientOAuth2` class that throws when its methods are
 * actually called. This lets the ported core source resolve imports while
 * making it explicit at runtime that the real client must be wired up first.
 */

export interface ClientOAuth2Options {
  accessTokenUri?: string;
  authorizationUri?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  state?: string;
  ignoreSSLIssues?: boolean;
  authentication?: 'header' | 'body';
  [key: string]: unknown;
}

export class ClientOAuth2Token {
  constructor(public client: ClientOAuth2, public data: Record<string, unknown>) {}

  get accessToken(): string {
    return (this.data.access_token as string) ?? '';
  }

  refresh(): Promise<ClientOAuth2Token> {
    throw new Error('client-oauth2 stub: refresh() is not implemented in sabflow.');
  }

  expired(): boolean {
    return false;
  }

  sign(_request: unknown): unknown {
    throw new Error('client-oauth2 stub: sign() is not implemented in sabflow.');
  }
}

export class ClientOAuth2 {
  constructor(public options: ClientOAuth2Options) {}

  createToken(data: Record<string, unknown>): ClientOAuth2Token {
    return new ClientOAuth2Token(this, data);
  }

  async getToken(_uri: string, _opts?: unknown): Promise<ClientOAuth2Token> {
    throw new Error('client-oauth2 stub: getToken() is not implemented in sabflow.');
  }

  credentials = {
    getToken: async (): Promise<ClientOAuth2Token> => {
      throw new Error('client-oauth2 stub: credentials.getToken() is not implemented in sabflow.');
    },
  };

  code = {
    getUri: () => '',
    getToken: async (): Promise<ClientOAuth2Token> => {
      throw new Error('client-oauth2 stub: code.getToken() is not implemented in sabflow.');
    },
  };
}
