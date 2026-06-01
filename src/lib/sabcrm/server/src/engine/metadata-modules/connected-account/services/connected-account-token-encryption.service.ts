import 'server-only';

import { isDefined } from 'twenty-shared/utils';

import {
  type EncryptedConnectionParameters,
  type EncryptedImapSmtpCaldavParams,
} from 'src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { type EncryptedString } from 'src/lib/sabcrm/server/src/engine/core-modules/secret-encryption/branded-strings/encrypted-string.type';
import { type PlaintextString } from 'src/lib/sabcrm/server/src/engine/core-modules/secret-encryption/branded-strings/plaintext-string.type';
import { SECRET_ENCRYPTION_ENVELOPE_PREFIX } from 'src/lib/sabcrm/server/src/engine/core-modules/secret-encryption/constants/secret-encryption.constant';
import { SecretEncryptionService } from 'src/lib/sabcrm/server/src/engine/core-modules/secret-encryption/secret-encryption.service';

// PORT-NOTE: Ported from NestJS @Injectable ConnectedAccountTokenEncryptionService.
// Dependency injection replaced with a module-level singleton via a factory.
// Callers must provide a configured SecretEncryptionService instance.

// PlaintextConnectionParameters mirrors EncryptedConnectionParameters but with PlaintextString password
export type PlaintextConnectionParameters = Omit<
  EncryptedConnectionParameters,
  'password'
> & { password: PlaintextString };

export type PlaintextImapSmtpCaldavParams = {
  IMAP?: PlaintextConnectionParameters;
  SMTP?: PlaintextConnectionParameters;
  CALDAV?: PlaintextConnectionParameters;
};

const ACCOUNT_TYPES = ['IMAP', 'SMTP', 'CALDAV'] as const;

function looksLikeCiphertext(value: string): boolean {
  return value.startsWith(SECRET_ENCRYPTION_ENVELOPE_PREFIX);
}

export function encryptToken({
  plaintext,
  workspaceId,
  encryptionService,
}: {
  plaintext: PlaintextString;
  workspaceId: string;
  encryptionService: SecretEncryptionService;
}): EncryptedString {
  if (looksLikeCiphertext(plaintext)) {
    throw new Error(
      'ConnectedAccountTokenEncryptionService.encrypt received an already-encrypted envelope. ' +
        'This indicates a double-encryption bug — the caller is encrypting ciphertext.',
    );
  }
  return encryptionService.encryptVersioned(plaintext, { workspaceId });
}

export function encryptTokenNullable({
  plaintext,
  workspaceId,
  encryptionService,
}: {
  plaintext: PlaintextString | null;
  workspaceId: string;
  encryptionService: SecretEncryptionService;
}): EncryptedString | null {
  if (!isDefined(plaintext)) {
    return null;
  }
  return encryptToken({ plaintext, workspaceId, encryptionService });
}

export function decryptToken({
  ciphertext,
  workspaceId,
  encryptionService,
}: {
  ciphertext: EncryptedString;
  workspaceId: string;
  encryptionService: SecretEncryptionService;
}): PlaintextString {
  if (!ciphertext.startsWith(SECRET_ENCRYPTION_ENVELOPE_PREFIX)) {
    throw new Error(
      'Received a plaintext value where ciphertext was expected. ' +
        'The encryption backfill migration may not have run.',
    );
  }
  return encryptionService.decryptVersioned(ciphertext, { workspaceId });
}

export function decryptTokenNullable({
  ciphertext,
  workspaceId,
  encryptionService,
}: {
  ciphertext: EncryptedString | null;
  workspaceId: string;
  encryptionService: SecretEncryptionService;
}): PlaintextString | null {
  if (!isDefined(ciphertext)) {
    return null;
  }
  return decryptToken({ ciphertext, workspaceId, encryptionService });
}

export function encryptTokenPair({
  accessToken,
  refreshToken,
  workspaceId,
  encryptionService,
}: {
  accessToken: PlaintextString;
  refreshToken: PlaintextString | null;
  workspaceId: string;
  encryptionService: SecretEncryptionService;
}): {
  encryptedAccessToken: EncryptedString;
  encryptedRefreshToken: EncryptedString | null;
} {
  return {
    encryptedAccessToken: encryptToken({ plaintext: accessToken, workspaceId, encryptionService }),
    encryptedRefreshToken: encryptTokenNullable({ plaintext: refreshToken, workspaceId, encryptionService }),
  };
}

export function encryptConnectionParameters({
  connectionParameters,
  workspaceId,
  encryptionService,
}: {
  connectionParameters: PlaintextImapSmtpCaldavParams;
  workspaceId: string;
  encryptionService: SecretEncryptionService;
}): EncryptedImapSmtpCaldavParams {
  const result: EncryptedImapSmtpCaldavParams = {};

  for (const protocol of ACCOUNT_TYPES) {
    const params = connectionParameters[protocol];
    if (!isDefined(params)) {
      continue;
    }
    result[protocol] = {
      ...params,
      password: encryptToken({ plaintext: params.password, workspaceId, encryptionService }),
    };
  }

  return result;
}

export function decryptConnectionParameters({
  connectionParameters,
  workspaceId,
  encryptionService,
}: {
  connectionParameters: EncryptedImapSmtpCaldavParams;
  workspaceId: string;
  encryptionService: SecretEncryptionService;
}): PlaintextImapSmtpCaldavParams {
  const result: PlaintextImapSmtpCaldavParams = {};

  for (const protocol of ACCOUNT_TYPES) {
    const params = connectionParameters[protocol];
    if (!isDefined(params)) {
      continue;
    }
    result[protocol] = decryptProtocolPassword({ protocolParams: params, workspaceId, encryptionService });
  }

  return result;
}

export function decryptProtocolPassword({
  protocolParams,
  workspaceId,
  encryptionService,
}: {
  protocolParams: EncryptedConnectionParameters;
  workspaceId: string;
  encryptionService: SecretEncryptionService;
}): PlaintextConnectionParameters {
  const isEncrypted = protocolParams.password.startsWith(SECRET_ENCRYPTION_ENVELOPE_PREFIX);

  // TODO: Remove after slow instance command finishes backfilling all legacy plaintext passwords.
  if (!isEncrypted) {
    console.warn(
      'Protocol password is not encrypted. Expected during the rollout window until the slow instance command finishes backfilling.',
    );
    const rawPassword: string = protocolParams.password;
    return {
      ...protocolParams,
      password: rawPassword as PlaintextString,
    };
  }

  return {
    ...protocolParams,
    password: decryptToken({ ciphertext: protocolParams.password, workspaceId, encryptionService }),
  };
}
