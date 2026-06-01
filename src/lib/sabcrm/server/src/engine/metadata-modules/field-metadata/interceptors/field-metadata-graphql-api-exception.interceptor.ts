// PORT-NOTE: NestJS NestInterceptor / catchError (RxJS) have no Next.js
// equivalent. This module exports a plain higher-order wrapper function that
// replicates the same exception-catching behaviour: any error thrown by the
// wrapped call is passed through fieldMetadataGraphqlApiExceptionHandler.

import { fieldMetadataGraphqlApiExceptionHandler } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/utils/field-metadata-graphql-api-exception-handler.util";

/**
 * Wraps an async function so that any thrown error is routed through the
 * field-metadata GraphQL exception handler before re-throwing.
 *
 * Usage:
 *   const result = await withFieldMetadataGraphqlExceptionHandling(
 *     () => someFieldMetadataOperation(),
 *   );
 */
export async function withFieldMetadataGraphqlExceptionHandling<T>(
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    // fieldMetadataGraphqlApiExceptionHandler always throws (never returns
    // normally), so the cast below is safe.
    return fieldMetadataGraphqlApiExceptionHandler(err as Error) as never;
  }
}
