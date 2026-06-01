import "server-only";

// service: EmailAliasManagerService → plain exported functions backed by Mongo
// Refreshes handle aliases for a connected account by dispatching to the
// correct provider driver, then persists the result.

import { connectToDatabase } from "@/lib/mongodb";
import { getGoogleHandleAliases } from "../drivers/google/services/google-email-alias-manager.service";
import { getMicrosoftHandleAliases } from "../drivers/microsoft/services/microsoft-email-alias-manager.service";

// Provider enum (sourced from twenty-shared/types)
export const ConnectedAccountProvider = {
  GOOGLE: "GOOGLE",
  MICROSOFT: "MICROSOFT",
  IMAP_SMTP_CALDAV: "IMAP_SMTP_CALDAV",
  OIDC: "OIDC",
  SAML: "SAML",
  EMAIL_GROUP: "EMAIL_GROUP",
  APP: "APP",
} as const;
export type ConnectedAccountProvider =
  (typeof ConnectedAccountProvider)[keyof typeof ConnectedAccountProvider];

export interface ConnectedAccountDoc {
  id: string;
  workspaceId: string;
  provider: ConnectedAccountProvider;
  handleAliases?: string[];
  [key: string]: unknown;
}

async function getConnectedAccountCollection() {
  const { db } = await connectToDatabase();
  return db.collection<ConnectedAccountDoc>("sabcrm_connected_account");
}

export async function refreshHandleAliases(
  connectedAccount: ConnectedAccountDoc,
  workspaceId: string,
): Promise<string[]> {
  let handleAliases: string[];

  switch (connectedAccount.provider) {
    case ConnectedAccountProvider.MICROSOFT:
      handleAliases = await getMicrosoftHandleAliases({
        id: connectedAccount.id,
        workspaceId,
      });
      break;

    case ConnectedAccountProvider.GOOGLE:
      handleAliases = await getGoogleHandleAliases({
        id: connectedAccount.id,
        workspaceId,
      });
      break;

    case ConnectedAccountProvider.IMAP_SMTP_CALDAV:
    case ConnectedAccountProvider.OIDC:
    case ConnectedAccountProvider.SAML:
    case ConnectedAccountProvider.EMAIL_GROUP:
    case ConnectedAccountProvider.APP:
      handleAliases = [];
      break;

    default: {
      // assertUnreachable equivalent
      const _exhaustive: never = connectedAccount.provider;
      throw new Error(
        `Email alias manager for provider ${_exhaustive} is not implemented`,
      );
    }
  }

  const col = await getConnectedAccountCollection();

  await col.updateOne(
    { id: connectedAccount.id, workspaceId },
    { $set: { handleAliases } },
  );

  return handleAliases;
}
