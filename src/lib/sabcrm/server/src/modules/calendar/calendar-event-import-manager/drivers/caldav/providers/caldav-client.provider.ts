import "server-only";

// PORT-NOTE: NestJS @Injectable provider → plain exported async function.
// Repository injection replaced with MongoDB collection accessor.
// ConnectedAccountTokenEncryptionService replaced with decryptProtocolPassword.

import { type DAVClient } from "tsdav";

import {
  getConnectedAccountCollection,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/connected-account/entities/connected-account.entity";
import {
  decryptProtocolPassword,
  type EncryptedConnectionParameters,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/connected-account/services/connected-account-token-encryption.service";
import {
  getSecretEncryptionService,
} from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/secret-encryption.service";
import {
  getCalDavClient,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/caldav/services/caldav-client.service";

// PORT-NOTE: CalendarEventImportDriverException not yet ported — using Error.
class CalendarEventImportDriverException extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "CalendarEventImportDriverException";
  }
}

const CalendarEventImportDriverExceptionCode = {
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
} as const;

const CONNECTED_ACCOUNT_PROVIDER_IMAP_SMTP_CALDAV = "IMAP_SMTP_CALDAV";

/**
 * Loads the connected account from MongoDB, decrypts the CalDAV credentials,
 * and returns a ready-to-use DAVClient.
 */
export async function getCalDavClientForConnectedAccount(
  connectedAccountId: string,
): Promise<DAVClient> {
  const collection = await getConnectedAccountCollection();
  const connectedAccount = await collection.findOne({ id: connectedAccountId });

  if (
    connectedAccount == null ||
    connectedAccount.provider !== CONNECTED_ACCOUNT_PROVIDER_IMAP_SMTP_CALDAV ||
    connectedAccount.connectionParameters?.CALDAV == null
  ) {
    throw new CalendarEventImportDriverException(
      `Missing CalDAV credentials for connected account ${connectedAccountId}`,
      CalendarEventImportDriverExceptionCode.INSUFFICIENT_PERMISSIONS,
    );
  }

  const encryptionService = getSecretEncryptionService();
  const params = decryptProtocolPassword({
    protocolParams: connectedAccount.connectionParameters
      .CALDAV as EncryptedConnectionParameters,
    workspaceId: connectedAccount.workspaceId,
    encryptionService,
  });

  return getCalDavClient({
    serverUrl: params.host,
    username: params.username ?? connectedAccount.handle,
    password: params.password,
  });
}
