import "server-only";

// server-logic: GoogleOAuth2ClientProvider → plain exported function
// Builds a Google OAuth2 client for a given connected account by:
//   1. Loading the connected account from Mongo
//   2. Resolving (and decrypting) the refresh token
//   3. Constructing a google.auth.OAuth2 client with that token

import { google, type Auth } from "googleapis";
import { connectToDatabase } from "@/lib/mongodb";

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

// ---- Mongo collection ----

interface ConnectedAccountDoc {
  id: string;
  provider: string;
  workspaceId: string;
  refreshToken?: string;
  accessToken?: string;
  [key: string]: unknown;
}

async function getConnectedAccountCollection() {
  const { db } = await connectToDatabase();
  return db.collection<ConnectedAccountDoc>("sabcrm_connected_account");
}

// ---- Token decryption stub ----
// PORT-NOTE: In Twenty this used ConnectedAccountTokenEncryptionService.
// Replace with the ported implementation from
//   src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/services/connected-account-token-encryption.service.ts

function decryptToken(ciphertext: string): string {
  // Stub: assumes token stored in plaintext during development.
  // Replace with real AES-GCM decryption before production.
  return ciphertext;
}

// ---- Main export ----

export async function getGoogleOAuth2Client(
  connectedAccountId: string,
): Promise<Auth.OAuth2Client> {
  const col = await getConnectedAccountCollection();

  const connectedAccount = await col.findOne({ id: connectedAccountId });

  if (!connectedAccount) {
    throw new ConnectedAccountRefreshAccessTokenException(
      `Connected account ${connectedAccountId} not found`,
      ConnectedAccountRefreshAccessTokenExceptionCode.REFRESH_TOKEN_NOT_FOUND,
    );
  }

  if (connectedAccount.provider !== "GOOGLE") {
    throw new ConnectedAccountRefreshAccessTokenException(
      `Connected account ${connectedAccountId} is not a Google provider (got ${connectedAccount.provider})`,
      ConnectedAccountRefreshAccessTokenExceptionCode.PROVIDER_NOT_SUPPORTED,
    );
  }

  const encryptedRefreshToken = connectedAccount.refreshToken;

  if (!encryptedRefreshToken) {
    throw new ConnectedAccountRefreshAccessTokenException(
      `Refresh token missing for connected account ${connectedAccountId}`,
      ConnectedAccountRefreshAccessTokenExceptionCode.REFRESH_TOKEN_NOT_FOUND,
    );
  }

  const plaintextRefreshToken = decryptToken(encryptedRefreshToken);

  const clientId = process.env.AUTH_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.AUTH_GOOGLE_CLIENT_SECRET;

  try {
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oAuth2Client.setCredentials({ refresh_token: plaintextRefreshToken });
    return oAuth2Client;
  } catch (error) {
    console.error(`Error in GoogleOAuth2ClientProvider`, error);
    throw error;
  }
}
