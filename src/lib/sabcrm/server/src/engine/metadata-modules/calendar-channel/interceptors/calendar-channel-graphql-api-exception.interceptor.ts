// PORT-NOTE: NestJS interceptors have no direct Next.js equivalent.
// This module exports a plain error-handling wrapper that applies the same
// calendarChannelGraphqlApiExceptionHandler to a promise-returning function.
// In Next.js server actions, wrap calls with `withCalendarChannelExceptionHandling`.

import { calendarChannelGraphqlApiExceptionHandler } from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/utils/calendar-channel-graphql-api-exception-handler.util';

/**
 * Wraps an async function with the calendar channel GraphQL error-handling logic.
 * Use in place of the NestJS interceptor in server actions / route handlers.
 */
export async function withCalendarChannelExceptionHandling<T>(
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    calendarChannelGraphqlApiExceptionHandler(error as Error);
    // calendarChannelGraphqlApiExceptionHandler always throws; this is unreachable.
    throw error;
  }
}
