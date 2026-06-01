// PORT-NOTE: server-logic — NestJS @Catch ExceptionFilter ported to a plain
// function that maps TwoFactorAuthenticationException to HTTP-friendly errors.
// Lingui msg-tagged templates replaced with plain string messages.
// Use throwMappedTwoFactorAuthError() in server actions / API route handlers
// wherever the NestJS filter would have intercepted.

import {
  TwoFactorAuthenticationException,
  TwoFactorAuthenticationExceptionCode,
} from './two-factor-authentication.exception';

export class ForbiddenError extends Error {
  constructor(cause?: unknown) {
    const message =
      cause instanceof Error ? cause.message : 'Forbidden';

    super(message);
    this.name = 'ForbiddenError';
  }
}

export class UserInputError extends Error {
  readonly subCode: string;
  readonly userFriendlyMessage: string;

  constructor(
    message: string,
    meta: { subCode: string; userFriendlyMessage: string },
  ) {
    super(message);
    this.name = 'UserInputError';
    this.subCode = meta.subCode;
    this.userFriendlyMessage = meta.userFriendlyMessage;
  }
}

/**
 * Maps a TwoFactorAuthenticationException to a UserInputError or
 * ForbiddenError — mirrors what the NestJS exception filter did.
 * Call this inside server actions / route handlers.
 */
export function throwMappedTwoFactorAuthError(
  exception: TwoFactorAuthenticationException,
): never {
  switch (exception.code) {
    case TwoFactorAuthenticationExceptionCode.INVALID_OTP:
      throw new UserInputError(exception.message, {
        subCode: exception.code,
        userFriendlyMessage: 'Invalid verification code. Please try again.',
      });

    case TwoFactorAuthenticationExceptionCode.INVALID_CONFIGURATION:
    case TwoFactorAuthenticationExceptionCode.TWO_FACTOR_AUTHENTICATION_METHOD_NOT_FOUND:
    case TwoFactorAuthenticationExceptionCode.MALFORMED_DATABASE_OBJECT:
    case TwoFactorAuthenticationExceptionCode.TWO_FACTOR_AUTHENTICATION_METHOD_ALREADY_PROVISIONED:
      throw new ForbiddenError(exception);

    default: {
      const _exhaustive: never = exception.code;

      throw new Error(`Unhandled TwoFactorAuthenticationExceptionCode: ${_exhaustive}`);
    }
  }
}
