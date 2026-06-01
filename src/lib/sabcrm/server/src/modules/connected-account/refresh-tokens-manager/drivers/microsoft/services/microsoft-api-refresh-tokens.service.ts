import "server-only";

// service: MicrosoftAPIRefreshAccessTokenService → plain exported function
// Refreshes Microsoft OAuth2 tokens using MSAL ConfidentialClientApplication
// with a plaintext refresh token.

import { ConfidentialClientApplication } from "@azure/msal-node";

// ---- Exception types ----

export class ConnectedAccountRefreshAccessTokenException extends Error {
  constructor(
    message: string,
    public readonly code: ConnectedAccountRefreshAccessTokenExceptionCode,
  ) {
    super(message);
    this.name = "ConnectedAccountRefreshAccessTokenException";
  }
}

export const ConnectedAccountRefreshAccessTokenExceptionCode = {
  REFRESH_TOKEN_NOT_FOUND: "REFRESH_TOKEN_NOT_FOUND",
  ACCESS_TOKEN_NOT_FOUND: "ACCESS_TOKEN_NOT_FOUND",
  PROVIDER_NOT_SUPPORTED: "PROVIDER_NOT_SUPPORTED",
  INVALID_REFRESH_TOKEN: "INVALID_REFRESH_TOKEN",
  TEMPORARY_NETWORK_ERROR: "TEMPORARY_NETWORK_ERROR",
} as const;
export type ConnectedAccountRefreshAccessTokenExceptionCode =
  (typeof ConnectedAccountRefreshAccessTokenExceptionCode)[keyof typeof ConnectedAccountRefreshAccessTokenExceptionCode];

export type ConnectedAccountPlaintextTokens = {
  accessToken: string;
  refreshToken: string;
};

// ---- MSAL error parser stub ----
// PORT-NOTE: parseMsalError is ported at
//   src/lib/sabcrm/server/src/modules/connected-account/refresh-tokens-manager/drivers/microsoft/utils/parse-msal-error.util.ts
// Inline minimal version until that file is ported.

function parseMsalError(error: unknown): ConnectedAccountRefreshAccessTokenException {
  return new ConnectedAccountRefreshAccessTokenException(
    `Microsoft token refresh failed: ${error instanceof Error ? error.message : String(error)}`,
    ConnectedAccountRefreshAccessTokenExceptionCode.INVALID_REFRESH_TOKEN,
  );
}

// ---- Main export ----

export async function refreshMicrosoftTokens(
  refreshToken: string,
): Promise<ConnectedAccountPlaintextTokens> {
  const msalClient = new ConfidentialClientApplication({
    auth: {
      clientId: process.env.AUTH_MICROSOFT_CLIENT_ID ?? "",
      clientSecret: process.env.AUTH_MICROSOFT_CLIENT_SECRET ?? "",
      authority: "https://login.microsoftonline.com/common",
    },
  });

  try {
    const response = await msalClient.acquireTokenByRefreshToken({
      refreshToken,
      scopes: ["https://graph.microsoft.com/.default"],
      forceCache: true,
    });

    if (!response) {
      throw new ConnectedAccountRefreshAccessTokenException(
        "No response received from Microsoft token endpoint",
        ConnectedAccountRefreshAccessTokenExceptionCode.INVALID_REFRESH_TOKEN,
      );
    }

    const newRefreshToken = extractRefreshTokenFromCache(msalClient);

    return {
      accessToken: response.accessToken,
      refreshToken: newRefreshToken,
    };
  } catch (error) {
    if (error instanceof ConnectedAccountRefreshAccessTokenException) {
      throw error;
    }

    throw parseMsalError(error);
  }
}

function extractRefreshTokenFromCache(
  msalClient: ConfidentialClientApplication,
): string {
  const tokenCache = JSON.parse(
    msalClient.getTokenCache().serialize(),
  ) as {
    RefreshToken: Record<string, { secret: string }>;
  };

  const refreshTokenKey = Object.keys(tokenCache.RefreshToken)[0];

  return tokenCache.RefreshToken[refreshTokenKey].secret;
}
