import "server-only";

// PORT-NOTE: Ported from NestJS ConnectedAccountRefreshTokensService.
// NestJS DI, TypeORM repositories, and @Injectable removed.
// Mongo collection used for persisting refreshed tokens.
// GoogleAPIRefreshAccessTokenService, MicrosoftAPIRefreshAccessTokenService,
// and AppOAuthRefreshAccessTokenService are injected at call-site (no DI container).

import { connectToDatabase } from "@/lib/mongodb";
import type { ConnectedAccountDocument } from "../../../../../../engine/metadata-modules/connected-account/entities/connected-account.entity";
import type { EncryptedString } from "../../../../../../engine/core-modules/secret-encryption/branded-strings/encrypted-string.type";
import type { PlaintextString } from "../../../../../../engine/core-modules/secret-encryption/branded-strings/plaintext-string.type";
import {
  ConnectedAccountRefreshAccessTokenException,
  ConnectedAccountRefreshAccessTokenExceptionCode,
} from "../../../../../../engine/metadata-modules/connected-account/exceptions/connected-account-refresh-tokens.exception";
import type { ConnectedAccountTokenEncryptionService } from "../../../../../../engine/metadata-modules/connected-account/services/connected-account-token-encryption.service";

// Tokens flowing through this service can be in two states depending on
// where they enter the pipeline. We model both shapes explicitly so the
// type system can prevent mixing encrypted and decrypted tokens in the same flow.
export type ConnectedAccountPlaintextTokens = {
  accessToken: PlaintextString;
  refreshToken: PlaintextString | null;
};

export type ConnectedAccountEncryptedTokens = {
  accessToken: EncryptedString;
  refreshToken: EncryptedString | null;
};

// Public return type of resolveTokens: always encrypted (either fresh from
// the database or freshly re-encrypted after a refresh round-trip).
export type ConnectedAccountTokens = ConnectedAccountEncryptedTokens;

// Provider enum values supported in this ported service
const ConnectedAccountProvider = {
  GOOGLE: "GOOGLE",
  MICROSOFT: "MICROSOFT",
  APP: "APP",
  IMAP_SMTP_CALDAV: "IMAP_SMTP_CALDAV",
  OIDC: "OIDC",
  SAML: "SAML",
  EMAIL_GROUP: "EMAIL_GROUP",
} as const;

type ConnectedAccountProviderType =
  (typeof ConnectedAccountProvider)[keyof typeof ConnectedAccountProvider];

// Minimal interface for the driver services (real impls ported separately)
interface IRefreshAccessTokenService {
  refreshTokens(
    refreshToken: PlaintextString,
    connectedAccount?: ConnectedAccountDocument,
  ): Promise<ConnectedAccountPlaintextTokens>;
}

const CONNECTED_ACCOUNT_ACCESS_TOKEN_EXPIRATION = 1000 * 60 * 60;

export function createConnectedAccountRefreshTokensService(deps: {
  googleAPIRefreshAccessTokenService: IRefreshAccessTokenService;
  microsoftAPIRefreshAccessTokenService: IRefreshAccessTokenService;
  appOAuthRefreshAccessTokenService: IRefreshAccessTokenService;
  connectedAccountTokenEncryptionService: ConnectedAccountTokenEncryptionService;
}) {
  const {
    googleAPIRefreshAccessTokenService,
    microsoftAPIRefreshAccessTokenService,
    appOAuthRefreshAccessTokenService,
    connectedAccountTokenEncryptionService,
  } = deps;

  async function resolveTokens(
    connectedAccount: ConnectedAccountDocument,
    workspaceId: string,
  ): Promise<ConnectedAccountTokens> {
    const isValid = await isAccessTokenStillValid(connectedAccount);

    if (isValid) {
      return getExistingEncryptedTokens(connectedAccount, workspaceId);
    }

    const encryptedRefreshToken = connectedAccount.refreshToken;

    if (!encryptedRefreshToken) {
      throw new ConnectedAccountRefreshAccessTokenException(
        `No refresh token found for connected account ${connectedAccount.id} in workspace ${workspaceId}`,
        ConnectedAccountRefreshAccessTokenExceptionCode.REFRESH_TOKEN_NOT_FOUND,
      );
    }

    return performRefreshAndSave(
      connectedAccount,
      encryptedRefreshToken,
      workspaceId,
    );
  }

  function getExistingEncryptedTokens(
    connectedAccount: ConnectedAccountDocument,
    workspaceId: string,
  ): ConnectedAccountTokens {
    if (!connectedAccount.accessToken) {
      throw new ConnectedAccountRefreshAccessTokenException(
        `Access token is required for connected account ${connectedAccount.id} in workspace ${workspaceId}`,
        ConnectedAccountRefreshAccessTokenExceptionCode.ACCESS_TOKEN_NOT_FOUND,
      );
    }

    return {
      accessToken: connectedAccount.accessToken,
      refreshToken: connectedAccount.refreshToken,
    };
  }

  async function performRefreshAndSave(
    connectedAccount: ConnectedAccountDocument,
    encryptedRefreshToken: EncryptedString,
    workspaceId: string,
  ): Promise<ConnectedAccountTokens> {
    const decryptedRefreshToken =
      connectedAccountTokenEncryptionService.decrypt({
        ciphertext: encryptedRefreshToken,
        workspaceId,
      });

    const plaintextTokens = await refreshTokens(
      connectedAccount,
      decryptedRefreshToken,
      workspaceId,
    );

    const {
      encryptedAccessToken,
      encryptedRefreshToken: reEncryptedRefreshToken,
    } = connectedAccountTokenEncryptionService.encryptTokenPair({
      accessToken: plaintextTokens.accessToken,
      refreshToken: plaintextTokens.refreshToken,
      workspaceId,
    });

    const { db } = await connectToDatabase();
    await db.collection("sabcrm_connected_account").updateOne(
      { id: connectedAccount.id, workspaceId },
      {
        $set: {
          accessToken: encryptedAccessToken,
          refreshToken: reEncryptedRefreshToken,
          lastCredentialsRefreshedAt: new Date(),
        },
      },
    );

    return {
      accessToken: encryptedAccessToken,
      refreshToken: reEncryptedRefreshToken,
    };
  }

  async function isAccessTokenStillValid(
    connectedAccount: ConnectedAccountDocument,
  ): Promise<boolean> {
    const provider =
      connectedAccount.provider as ConnectedAccountProviderType;

    switch (provider) {
      case ConnectedAccountProvider.GOOGLE:
      case ConnectedAccountProvider.MICROSOFT:
      case ConnectedAccountProvider.APP: {
        if (!connectedAccount.lastCredentialsRefreshedAt) {
          return false;
        }

        const BUFFER_TIME = 5 * 60 * 1000;
        const tokenExpirationTime =
          CONNECTED_ACCOUNT_ACCESS_TOKEN_EXPIRATION - BUFFER_TIME;

        return (
          connectedAccount.lastCredentialsRefreshedAt >
          new Date(Date.now() - tokenExpirationTime)
        );
      }
      case ConnectedAccountProvider.IMAP_SMTP_CALDAV:
      case ConnectedAccountProvider.OIDC:
      case ConnectedAccountProvider.SAML:
      case ConnectedAccountProvider.EMAIL_GROUP:
        return true;
      default: {
        // Exhaustive check — unknown provider treated as unsupported
        return false;
      }
    }
  }

  async function refreshTokens(
    connectedAccount: ConnectedAccountDocument,
    refreshToken: PlaintextString,
    workspaceId: string,
  ): Promise<ConnectedAccountPlaintextTokens> {
    const provider =
      connectedAccount.provider as ConnectedAccountProviderType;

    try {
      switch (provider) {
        case ConnectedAccountProvider.GOOGLE:
          return await googleAPIRefreshAccessTokenService.refreshTokens(
            refreshToken,
          );
        case ConnectedAccountProvider.MICROSOFT:
          return await microsoftAPIRefreshAccessTokenService.refreshTokens(
            refreshToken,
          );
        case ConnectedAccountProvider.APP:
          return await appOAuthRefreshAccessTokenService.refreshTokens(
            refreshToken,
            connectedAccount,
          );
        case ConnectedAccountProvider.IMAP_SMTP_CALDAV:
        case ConnectedAccountProvider.OIDC:
        case ConnectedAccountProvider.SAML:
        case ConnectedAccountProvider.EMAIL_GROUP:
          throw new ConnectedAccountRefreshAccessTokenException(
            `Token refresh is not supported for ${provider} provider for connected account ${connectedAccount.id} in workspace ${workspaceId}`,
            ConnectedAccountRefreshAccessTokenExceptionCode.PROVIDER_NOT_SUPPORTED,
          );
        default:
          throw new ConnectedAccountRefreshAccessTokenException(
            `Provider ${provider} not supported`,
            ConnectedAccountRefreshAccessTokenExceptionCode.PROVIDER_NOT_SUPPORTED,
          );
      }
    } catch (error) {
      console.error(
        `Error while refreshing tokens on connected account ${connectedAccount.id} in workspace ${workspaceId}`,
        error,
      );
      throw error;
    }
  }

  return {
    resolveTokens,
    isAccessTokenStillValid,
    refreshTokens,
  };
}

// Legacy stub exports retained for backward compatibility
export async function refreshConnectedAccountTokens(
  connectedAccountId: string,
  workspaceId: string,
): Promise<ConnectedAccountPlaintextTokens> {
  throw new Error(
    `refreshConnectedAccountTokens not yet fully ported for account ${connectedAccountId} in workspace ${workspaceId}`,
  );
}

export async function resolveConnectedAccountTokens(
  connectedAccountId: string,
  workspaceId: string,
): Promise<ConnectedAccountPlaintextTokens> {
  throw new Error(
    `resolveConnectedAccountTokens not yet fully ported for account ${connectedAccountId} in workspace ${workspaceId}`,
  );
}
