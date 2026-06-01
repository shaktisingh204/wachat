import "server-only";

// server-logic: MicrosoftOAuth2ClientProvider → plain exported function
// Builds a @microsoft/microsoft-graph-client Client for a connected account by:
//   1. Loading the connected account from Mongo
//   2. Resolving (and decrypting) the access token
//   3. Constructing a Graph Client with the custom auth provider

import { Client } from "@microsoft/microsoft-graph-client";
import { connectToDatabase } from "@/lib/mongodb";
import { MicrosoftOAuth2ClientAuthProvider } from "./microsoft-oauth2-client-auth-provider";

// ---- Exception types (shared with Google provider) ----

export class ConnectedAccountRefreshAccessTokenException extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ConnectedAccountRefreshAccessTokenException";
  }
}

export const ConnectedAccountRefreshAccessTokenExceptionCode = {
  REFRESH_TOKEN_NOT_FOUND: "REFRESH_TOKEN_NOT_FOUND",
  ACCESS_TOKEN_NOT_FOUND: "ACCESS_TOKEN_NOT_FOUND",
  PROVIDER_NOT_SUPPORTED: "PROVIDER_NOT_SUPPORTED",
} as const;

// ---- Mongo collection ----

interface ConnectedAccountDoc {
  id: string;
  provider: string;
  workspaceId: string;
  accessToken?: string;
  [key: string]: unknown;
}

async function getConnectedAccountCollection() {
  const { db } = await connectToDatabase();
  return db.collection<ConnectedAccountDoc>("sabcrm_connected_account");
}

// ---- Token decryption stub ----
// PORT-NOTE: Replace with real AES-GCM decryption from
//   src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/services/connected-account-token-encryption.service.ts

function decryptToken(ciphertext: string): string {
  return ciphertext;
}

// ---- Main export ----

export async function getMicrosoftOAuth2Client(
  connectedAccountId: string,
): Promise<Client> {
  const col = await getConnectedAccountCollection();

  const connectedAccount = await col.findOne({ id: connectedAccountId });

  if (!connectedAccount) {
    throw new ConnectedAccountRefreshAccessTokenException(
      `Connected account ${connectedAccountId} not found`,
      ConnectedAccountRefreshAccessTokenExceptionCode.REFRESH_TOKEN_NOT_FOUND,
    );
  }

  if (connectedAccount.provider !== "MICROSOFT") {
    throw new ConnectedAccountRefreshAccessTokenException(
      `Connected account ${connectedAccountId} is not a Microsoft provider (got ${connectedAccount.provider})`,
      ConnectedAccountRefreshAccessTokenExceptionCode.PROVIDER_NOT_SUPPORTED,
    );
  }

  const encryptedAccessToken = connectedAccount.accessToken;

  if (!encryptedAccessToken) {
    throw new ConnectedAccountRefreshAccessTokenException(
      `Access token missing for connected account ${connectedAccountId}`,
      ConnectedAccountRefreshAccessTokenExceptionCode.ACCESS_TOKEN_NOT_FOUND,
    );
  }

  const plaintextAccessToken = decryptToken(encryptedAccessToken);

  const authProvider = new MicrosoftOAuth2ClientAuthProvider(
    plaintextAccessToken,
  );

  return Client.initWithMiddleware({
    defaultVersion: "v1.0",
    debugLogging: false,
    authProvider,
  });
}
