import "server-only";

// server-logic: parseGoogleOAuthError utility
// Converts raw Gaxios / network errors from Google OAuth2 into typed
// ConnectedAccountRefreshAccessTokenException instances.

import type { GaxiosError } from "gaxios";

// ---- Exception types (inline to avoid circular imports) ----

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

// ---- Network-error guard (port of is-gmail-network-error.util.ts) ----

function isGmailNetworkError(
  error: unknown,
): error is { code: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as Record<string, unknown>).code === "string" &&
    [
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
      "ECONNREFUSED",
    ].includes((error as { code: string }).code)
  );
}

// ---- Main utility ----

export const parseGoogleOAuthError = (
  error: unknown,
): ConnectedAccountRefreshAccessTokenException => {
  if (isGmailNetworkError(error)) {
    return new ConnectedAccountRefreshAccessTokenException(
      `Google refresh token network error: ${error.code} - ${error.message}`,
      ConnectedAccountRefreshAccessTokenExceptionCode.TEMPORARY_NETWORK_ERROR,
    );
  }

  const gaxiosError = error as GaxiosError;

  const googleOAuthError = {
    code: gaxiosError.response?.status,
    reason:
      (
        gaxiosError.response?.data as
          | { error?: string; error_description?: string }
          | undefined
      )?.error ??
      (
        gaxiosError.response?.data as
          | { error?: string; error_description?: string }
          | undefined
      )?.error_description ??
      "Unknown reason",
    message:
      (
        gaxiosError.response?.data as
          | { error_description?: string }
          | undefined
      )?.error_description ??
      gaxiosError.message ??
      "Unknown error",
  };

  switch (googleOAuthError.code) {
    case 400:
      return new ConnectedAccountRefreshAccessTokenException(
        googleOAuthError.message,
        ConnectedAccountRefreshAccessTokenExceptionCode.INVALID_REFRESH_TOKEN,
      );

    case 401:
      return new ConnectedAccountRefreshAccessTokenException(
        googleOAuthError.message,
        ConnectedAccountRefreshAccessTokenExceptionCode.INVALID_REFRESH_TOKEN,
      );

    case 403:
      return new ConnectedAccountRefreshAccessTokenException(
        googleOAuthError.message,
        ConnectedAccountRefreshAccessTokenExceptionCode.INVALID_REFRESH_TOKEN,
      );

    case 429:
      return new ConnectedAccountRefreshAccessTokenException(
        googleOAuthError.message,
        ConnectedAccountRefreshAccessTokenExceptionCode.TEMPORARY_NETWORK_ERROR,
      );

    case 500:
    case 502:
    case 503:
    case 504:
      return new ConnectedAccountRefreshAccessTokenException(
        `${googleOAuthError.code} - ${googleOAuthError.message}`,
        ConnectedAccountRefreshAccessTokenExceptionCode.TEMPORARY_NETWORK_ERROR,
      );

    default:
      break;
  }

  return new ConnectedAccountRefreshAccessTokenException(
    `Google refresh token failed: ${googleOAuthError.message}`,
    ConnectedAccountRefreshAccessTokenExceptionCode.INVALID_REFRESH_TOKEN,
  );
};
