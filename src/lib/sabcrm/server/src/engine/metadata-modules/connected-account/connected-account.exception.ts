// PORT-NOTE: @lingui/core/macro and assertUnreachable replaced with plain TypeScript.
// Lingui msg`` tag dropped; user-friendly messages stored as plain strings.

export enum ConnectedAccountExceptionCode {
  CONNECTED_ACCOUNT_NOT_FOUND = 'CONNECTED_ACCOUNT_NOT_FOUND',
  INVALID_CONNECTED_ACCOUNT_INPUT = 'INVALID_CONNECTED_ACCOUNT_INPUT',
  CONNECTED_ACCOUNT_OWNERSHIP_VIOLATION = 'CONNECTED_ACCOUNT_OWNERSHIP_VIOLATION',
}

const USER_FRIENDLY_MESSAGES: Record<ConnectedAccountExceptionCode, string> = {
  [ConnectedAccountExceptionCode.CONNECTED_ACCOUNT_NOT_FOUND]:
    'Connected account not found.',
  [ConnectedAccountExceptionCode.INVALID_CONNECTED_ACCOUNT_INPUT]:
    'Invalid connected account input.',
  [ConnectedAccountExceptionCode.CONNECTED_ACCOUNT_OWNERSHIP_VIOLATION]:
    'You do not have access to this connected account.',
};

export class ConnectedAccountException extends Error {
  readonly code: ConnectedAccountExceptionCode;
  readonly userFriendlyMessage: string;

  constructor(
    message: string,
    code: ConnectedAccountExceptionCode,
    options?: { userFriendlyMessage?: string },
  ) {
    super(message);
    this.name = 'ConnectedAccountException';
    this.code = code;
    this.userFriendlyMessage =
      options?.userFriendlyMessage ?? USER_FRIENDLY_MESSAGES[code];
  }
}
