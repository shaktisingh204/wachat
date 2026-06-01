import { type ConnectedAccountPublicDTO } from 'src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/dtos/connected-account-public.dto';
import { type ConnectedAccountDocument } from 'src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/entities/connected-account.entity';

// PORT-NOTE: Ported from buildPublicConnectedAccount.util.ts.
// buildPublicConnectionParameters strips encrypted passwords so only host/port/username/secure remain.

function buildPublicConnectionParameters(
  connectionParameters: ConnectedAccountDocument['connectionParameters'],
): ConnectedAccountPublicDTO['connectionParameters'] {
  if (!connectionParameters) {
    return null;
  }

  const result: ConnectedAccountPublicDTO['connectionParameters'] = {};

  const protocols = ['IMAP', 'SMTP', 'CALDAV'] as const;

  for (const protocol of protocols) {
    const params = connectionParameters[protocol];
    if (!params) {
      continue;
    }
    // Strip the password field — only expose host, port, username, secure
    result[protocol] = {
      host: params.host,
      port: params.port,
      ...(params.username !== undefined ? { username: params.username } : {}),
      ...(params.secure !== undefined ? { secure: params.secure } : {}),
    };
  }

  return result;
}

export function buildPublicConnectedAccount(
  account: ConnectedAccountDocument,
): ConnectedAccountPublicDTO;
export function buildPublicConnectedAccount(
  account: ConnectedAccountDocument | null,
): ConnectedAccountPublicDTO | null;
export function buildPublicConnectedAccount(
  account: ConnectedAccountDocument | null,
): ConnectedAccountPublicDTO | null {
  if (!account) {
    return null;
  }

  return {
    ...account,
    connectionParameters: buildPublicConnectionParameters(
      account.connectionParameters,
    ),
  };
}
