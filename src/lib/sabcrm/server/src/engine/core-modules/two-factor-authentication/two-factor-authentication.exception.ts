// PORT-NOTE: Ported from NestJS CustomException. Lingui `msg` tags converted to
// plain string descriptors since there is no Lingui context in Next.js server code.

export enum TwoFactorAuthenticationExceptionCode {
  INVALID_CONFIGURATION = "INVALID_CONFIGURATION",
  TWO_FACTOR_AUTHENTICATION_METHOD_NOT_FOUND = "TWO_FACTOR_AUTHENTICATION_METHOD_NOT_FOUND",
  INVALID_OTP = "INVALID_OTP",
  TWO_FACTOR_AUTHENTICATION_METHOD_ALREADY_PROVISIONED = "TWO_FACTOR_AUTHENTICATION_METHOD_ALREADY_PROVISIONED",
  MALFORMED_DATABASE_OBJECT = "MALFORMED_DATABASE_OBJECT",
}

export class TwoFactorAuthenticationException extends Error {
  readonly code: TwoFactorAuthenticationExceptionCode;

  constructor(
    message: string,
    code: TwoFactorAuthenticationExceptionCode,
  ) {
    super(message);
    this.name = "TwoFactorAuthenticationException";
    this.code = code;
  }
}
