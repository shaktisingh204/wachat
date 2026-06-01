// PORT-NOTE: @lingui/core/macro msg`` tag replaced with plain strings.
// assertUnreachable from twenty-shared/utils removed; exhaustive check done via never cast.

export enum ConnectedAccountRefreshAccessTokenExceptionCode {
  REFRESH_TOKEN_NOT_FOUND = 'REFRESH_TOKEN_NOT_FOUND',
  INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',
  PROVIDER_NOT_SUPPORTED = 'PROVIDER_NOT_SUPPORTED',
  TEMPORARY_NETWORK_ERROR = 'TEMPORARY_NETWORK_ERROR',
  ACCESS_TOKEN_NOT_FOUND = 'ACCESS_TOKEN_NOT_FOUND',
}

const USER_FRIENDLY_MESSAGES: Record<
  ConnectedAccountRefreshAccessTokenExceptionCode,
  string
> = {
  [ConnectedAccountRefreshAccessTokenExceptionCode.REFRESH_TOKEN_NOT_FOUND]:
    'Refresh token not found.',
  [ConnectedAccountRefreshAccessTokenExceptionCode.INVALID_REFRESH_TOKEN]:
    'Invalid refresh token.',
  [ConnectedAccountRefreshAccessTokenExceptionCode.PROVIDER_NOT_SUPPORTED]:
    'This provider is not supported.',
  [ConnectedAccountRefreshAccessTokenExceptionCode.TEMPORARY_NETWORK_ERROR]:
    'A temporary network error occurred.',
  [ConnectedAccountRefreshAccessTokenExceptionCode.ACCESS_TOKEN_NOT_FOUND]:
    'Access token not found.',
};

export class ConnectedAccountRefreshAccessTokenException extends Error {
  readonly code: ConnectedAccountRefreshAccessTokenExceptionCode;
  readonly userFriendlyMessage: string;

  constructor(
    message: string,
    code: ConnectedAccountRefreshAccessTokenExceptionCode,
    options?: { userFriendlyMessage?: string },
  ) {
    super(message);
    this.name = 'ConnectedAccountRefreshAccessTokenException';
    this.code = code;
    this.userFriendlyMessage =
      options?.userFriendlyMessage ?? USER_FRIENDLY_MESSAGES[code];
  }
}
