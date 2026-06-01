// PORT-NOTE: NestJS NestInterceptor has no direct Next.js equivalent.
// Exported as a plain wrapper function that maps ConnectedAccountException codes
// to appropriate HTTP/API errors. Use wrapWithConnectedAccountExceptionHandling()
// around action/route handlers in place of the @UseInterceptors() decorator.

import { connectedAccountGraphqlApiExceptionHandler } from 'src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/utils/connected-account-graphql-api-exception-handler.util';

export async function wrapWithConnectedAccountExceptionHandling<T>(
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    connectedAccountGraphqlApiExceptionHandler(error as Error);
    // connectedAccountGraphqlApiExceptionHandler always throws
    throw error;
  }
}

/** @deprecated Use wrapWithConnectedAccountExceptionHandling instead */
export const ConnectedAccountGraphqlApiExceptionInterceptor =
  wrapWithConnectedAccountExceptionHandling;
