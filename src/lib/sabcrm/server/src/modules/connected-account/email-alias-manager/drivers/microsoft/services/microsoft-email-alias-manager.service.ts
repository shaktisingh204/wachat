import "server-only";

// service: MicrosoftEmailAliasManagerService → plain exported function
// Fetches non-primary SMTP aliases from Microsoft Graph /me?$select=proxyAddresses

import { getMicrosoftOAuth2Client } from "../../../../../../../oauth2-client-manager/drivers/microsoft/microsoft-oauth2-client.provider";

export interface ConnectedAccountLike {
  id: string;
  workspaceId: string;
}

export async function getMicrosoftHandleAliases(
  connectedAccount: ConnectedAccountLike,
): Promise<string[]> {
  const microsoftClient = await getMicrosoftOAuth2Client(connectedAccount.id);

  const response = await microsoftClient
    .api("/me?$select=proxyAddresses")
    .get()
    .catch((error: { message: string }) => {
      throw new Error(`Failed to fetch email aliases: ${error.message}`);
    });

  const proxyAddresses: string[] = response.proxyAddresses ?? [];

  const handleAliases = proxyAddresses
    .filter((address) => !address.startsWith("SMTP:"))
    .map((address) => address.replace("smtp:", "").toLowerCase())
    .filter((address) => address.length > 0);

  return handleAliases;
}
