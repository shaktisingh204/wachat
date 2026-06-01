// PORT-NOTE: NestJS HttpException/HttpStatus replaced with a plain Error
// subclass carrying the HTTP status code. Callers (API route handlers) should
// check `error.statusCode` and return the appropriate Next.js Response.

import {
  type ThrottlerException,
  ThrottlerExceptionCode,
} from '@/lib/sabcrm/server/src/engine/core-modules/throttler/throttler.exception';

function assertUnreachable(x: never): never {
  throw new Error(`Unhandled throttler exception code: ${String(x)}`);
}

export class HttpThrottleError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'HttpThrottleError';
    this.statusCode = statusCode;
  }
}

export const throttlerToRestApiExceptionHandler = (
  error: ThrottlerException,
): never => {
  switch (error.code) {
    case ThrottlerExceptionCode.LIMIT_REACHED:
      throw new HttpThrottleError(error.message, 429 /* TOO_MANY_REQUESTS */);
    default:
      return assertUnreachable(error.code);
  }
};
