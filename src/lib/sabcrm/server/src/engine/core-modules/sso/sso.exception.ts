// PORT-NOTE: Enterprise-only module. @license Enterprise
// Ported from twenty-server sso.exception.ts — NestJS/Lingui deps replaced
// with plain TS; msg`` tags become plain strings; assertUnreachable kept as
// a local helper.

export enum SSOExceptionCode {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  IDENTITY_PROVIDER_NOT_FOUND = 'IDENTITY_PROVIDER_NOT_FOUND',
  INVALID_ISSUER_URL = 'INVALID_ISSUER_URL',
  INVALID_IDP_TYPE = 'INVALID_IDP_TYPE',
  UNKNOWN_SSO_CONFIGURATION_ERROR = 'UNKNOWN_SSO_CONFIGURATION_ERROR',
  SSO_DISABLE = 'SSO_DISABLE',
}

function assertUnreachable(x: never): never {
  throw new Error(`Unhandled SSO exception code: ${String(x)}`);
}

function getSSOExceptionUserFriendlyMessage(code: SSOExceptionCode): string {
  switch (code) {
    case SSOExceptionCode.USER_NOT_FOUND:
      return 'User not found.';
    case SSOExceptionCode.IDENTITY_PROVIDER_NOT_FOUND:
      return 'Identity provider not found.';
    case SSOExceptionCode.INVALID_ISSUER_URL:
      return 'Invalid issuer URL.';
    case SSOExceptionCode.INVALID_IDP_TYPE:
      return 'Invalid identity provider type.';
    case SSOExceptionCode.UNKNOWN_SSO_CONFIGURATION_ERROR:
      return 'SSO configuration error.';
    case SSOExceptionCode.SSO_DISABLE:
      return 'SSO is disabled.';
    default:
      return assertUnreachable(code);
  }
}

export class SSOException extends Error {
  readonly code: SSOExceptionCode;
  readonly userFriendlyMessage: string;

  constructor(
    message: string,
    code: SSOExceptionCode,
    { userFriendlyMessage }: { userFriendlyMessage?: string } = {},
  ) {
    super(message);
    this.name = 'SSOException';
    this.code = code;
    this.userFriendlyMessage =
      userFriendlyMessage ?? getSSOExceptionUserFriendlyMessage(code);
  }
}
