import "server-only";

// service: GoogleAPIRefreshAccessTokenService → plain exported function
// Refreshes Google OAuth2 tokens using a plaintext refresh token.
// Returns both the new access token and the same refresh token.

import { google } from "googleapis";
import { parseGoogleOAuthError } from "../utils/parse-google-oauth-error.util";

// Re-export so callers have a single import point.
export type ConnectedAccountPlaintextTokens = {
  accessToken: string;
  refreshToken: string;
};

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

export async function refreshGoogleTokens(
  refreshToken: string,
): Promise<ConnectedAccountPlaintextTokens> {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_CLIENT_ID,
    process.env.AUTH_GOOGLE_CLIENT_SECRET,
  );

  oAuth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    const { token } = await oAuth2Client.getAccessToken();

    if (!token) {
      throw new ConnectedAccountRefreshAccessTokenException(
        "Error refreshing Google tokens: Invalid refresh token",
        ConnectedAccountRefreshAccessTokenExceptionCode.INVALID_REFRESH_TOKEN,
      );
    }

    return {
      accessToken: token,
      refreshToken,
    };
  } catch (error) {
    if (error instanceof ConnectedAccountRefreshAccessTokenException) {
      throw error;
    }

    throw parseGoogleOAuthError(error);
  }
}
