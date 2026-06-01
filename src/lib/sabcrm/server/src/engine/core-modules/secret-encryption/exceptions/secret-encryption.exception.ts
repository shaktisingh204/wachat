// port: SecretEncryptionException — ported to plain TS, dropping NestJS/Lingui.

export enum SecretEncryptionExceptionCode {
  NO_ENCRYPTION_KEY_CONFIGURED = "NO_ENCRYPTION_KEY_CONFIGURED",
  UNKNOWN_KEY_ID = "UNKNOWN_KEY_ID",
  MALFORMED_ENVELOPE = "MALFORMED_ENVELOPE",
  UNKNOWN_ENVELOPE_VERSION = "UNKNOWN_ENVELOPE_VERSION",
  INVALID_KEY_ID_FORMAT = "INVALID_KEY_ID_FORMAT",
  CIPHERTEXT_TOO_SHORT = "CIPHERTEXT_TOO_SHORT",
  ALREADY_ENCRYPTED = "ALREADY_ENCRYPTED",
}

export class SecretEncryptionException extends Error {
  public readonly code: SecretEncryptionExceptionCode;

  constructor(message: string, code: SecretEncryptionExceptionCode) {
    super(message);
    this.name = "SecretEncryptionException";
    this.code = code;
  }
}
