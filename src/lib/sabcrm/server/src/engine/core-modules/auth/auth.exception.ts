// PORT-NOTE: stub — auth.exception is not in this batch. This stub provides
// the minimum type surface needed by two-factor-authentication.service.ts.
// Replace with the full port when the auth module batch is processed.

export enum AuthExceptionCode {
  TWO_FACTOR_AUTHENTICATION_VERIFICATION_REQUIRED = "TWO_FACTOR_AUTHENTICATION_VERIFICATION_REQUIRED",
  TWO_FACTOR_AUTHENTICATION_PROVISION_REQUIRED = "TWO_FACTOR_AUTHENTICATION_PROVISION_REQUIRED",
  FORBIDDEN_EXCEPTION = "FORBIDDEN_EXCEPTION",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  WORKSPACE_NOT_FOUND = "WORKSPACE_NOT_FOUND",
  INVALID_INPUT = "INVALID_INPUT",
  INVALID_ID_TOKEN = "INVALID_ID_TOKEN",
  GOOGLE_API_AUTH_ERROR = "GOOGLE_API_AUTH_ERROR",
  MICROSOFT_API_AUTH_ERROR = "MICROSOFT_API_AUTH_ERROR",
  OAUTH_ACCESS_DENIED = "OAUTH_ACCESS_DENIED",
}

export class AuthException extends Error {
  readonly code: AuthExceptionCode;

  constructor(message: string, code: AuthExceptionCode) {
    super(message);
    this.name = "AuthException";
    this.code = code;
  }
}
