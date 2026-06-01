// PORT-NOTE: Ported from connectedAccountGraphqlApiExceptionHandler.util.ts.
// ForbiddenError / NotFoundError / UserInputError from Twenty's GraphQL utils are replaced
// with plain Error subclasses carrying a status code — callers adapt to their HTTP layer.

import {
  ConnectedAccountException,
  ConnectedAccountExceptionCode,
} from 'src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/connected-account.exception';

export class NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(cause: Error) {
    super(cause.message);
    this.name = 'NotFoundError';
    this.cause = cause;
  }
}

export class UserInputError extends Error {
  readonly statusCode = 400;
  constructor(cause: Error) {
    super(cause.message);
    this.name = 'UserInputError';
    this.cause = cause;
  }
}

export class ForbiddenError extends Error {
  readonly statusCode = 403;
  constructor(cause: Error) {
    super(cause.message);
    this.name = 'ForbiddenError';
    this.cause = cause;
  }
}

export const connectedAccountGraphqlApiExceptionHandler = (error: Error): never => {
  if (error instanceof ConnectedAccountException) {
    switch (error.code) {
      case ConnectedAccountExceptionCode.CONNECTED_ACCOUNT_NOT_FOUND:
        throw new NotFoundError(error);
      case ConnectedAccountExceptionCode.INVALID_CONNECTED_ACCOUNT_INPUT:
        throw new UserInputError(error);
      case ConnectedAccountExceptionCode.CONNECTED_ACCOUNT_OWNERSHIP_VIOLATION:
        throw new ForbiddenError(error);
      default: {
        // exhaustive check
        const _exhaustive: never = error.code;
        throw error;
      }
    }
  }

  throw error;
};
