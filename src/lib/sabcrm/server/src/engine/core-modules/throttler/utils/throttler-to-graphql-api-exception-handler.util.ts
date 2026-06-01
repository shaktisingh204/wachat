// PORT-NOTE: NestJS/GraphQL UserInputError replaced with a plain Error
// subclass that carries the same HTTP semantics. assertUnreachable is inlined.

import {
  type ThrottlerException,
  ThrottlerExceptionCode,
} from '@/lib/sabcrm/server/src/engine/core-modules/throttler/throttler.exception';

function assertUnreachable(x: never): never {
  throw new Error(`Unhandled throttler exception code: ${String(x)}`);
}

export class GraphQLThrottleError extends Error {
  constructor(cause: ThrottlerException) {
    super(cause.userFriendlyMessage ?? cause.message);
    this.name = 'GraphQLThrottleError';
  }
}

export const throttlerToGraphqlApiExceptionHandler = (
  error: ThrottlerException,
): never => {
  switch (error.code) {
    case ThrottlerExceptionCode.LIMIT_REACHED:
      throw new GraphQLThrottleError(error);
    default:
      return assertUnreachable(error.code);
  }
};
