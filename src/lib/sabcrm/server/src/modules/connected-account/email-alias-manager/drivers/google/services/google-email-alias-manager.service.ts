import "server-only";

// service: GoogleEmailAliasManagerService → plain exported function
// Fetches non-primary Gmail send-as aliases for a connected account.

import { google } from "googleapis";
import { handleGmailEmailAliasError } from "./google-email-alias-error-handler.service";
import { getGoogleOAuth2Client } from "../../../../../../../oauth2-client-manager/drivers/google/google-oauth2-client.provider";

// Minimal shape of ConnectedAccountEntity needed here
export interface ConnectedAccountLike {
  id: string;
  workspaceId: string;
}

export async function getGoogleHandleAliases(
  connectedAccount: ConnectedAccountLike,
): Promise<string[]> {
  const oAuth2Client = await getGoogleOAuth2Client(connectedAccount.id);

  const gmailClient = google.gmail({
    version: "v1",
    auth: oAuth2Client,
  });

  const sendAsResponse = await gmailClient.users.settings.sendAs
    .list({ userId: "me" })
    .catch((error: unknown) => {
      handleGmailEmailAliasError(error);
    });

  return (
    sendAsResponse?.data.sendAs
      ?.filter((alias) => alias.isPrimary !== true)
      .map((alias) => alias.sendAsEmail ?? "")
      .filter((email) => email.length > 0) ?? []
  );
}
