// PORT-NOTE: NestJS @Injectable / NestInterceptor / CallHandler / ExecutionContext dropped.
// In Next.js there is no NestJS interceptor mechanism. This module exports the same
// error-catching logic as a plain wrapper so server actions / route handlers can call it.

import { aiGraphqlApiExceptionHandler } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/utils/ai-graphql-api-exception-handler.util';

/**
 * Wraps an async server action with AiException -> GraphQL error mapping.
 * Equivalent to the original `AiGraphqlApiExceptionInterceptor.intercept` pipe.
 */
export const withAiGraphqlExceptionHandler = async <T>(
  fn: () => Promise<T>,
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    aiGraphqlApiExceptionHandler(error as Error);
    // aiGraphqlApiExceptionHandler always throws; this line is unreachable.
    throw error;
  }
};
