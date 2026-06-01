// PORT-NOTE: NestJS interceptor -> plain async wrapper for Next.js server actions.
// Use withCommandMenuItemExceptionHandling() to wrap service calls in route handlers.

import { commandMenuItemGraphqlApiExceptionHandler } from '@/lib/sabcrm/server/src/engine/metadata-modules/command-menu-item/utils/command-menu-item-graphql-api-exception-handler.util';

/**
 * Wraps an async function with the command menu item GraphQL error-handling logic.
 */
export async function withCommandMenuItemExceptionHandling<T>(
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    commandMenuItemGraphqlApiExceptionHandler(error as Error);
    // commandMenuItemGraphqlApiExceptionHandler always throws; unreachable.
    throw error;
  }
}
