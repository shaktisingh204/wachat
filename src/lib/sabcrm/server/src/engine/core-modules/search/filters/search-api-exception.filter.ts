// PORT-NOTE: NestJS @Catch() / ExceptionFilter interface replaced with a plain
// function that handles a SearchException and rethrows or transforms it.
// Use handleSearchException() in Next.js route handlers / server actions.

import {
  SearchException,
  SearchExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/search/exceptions/search.exception";

function assertUnreachable(x: never): never {
  throw new Error(`Unreachable case: ${String(x)}`);
}

/**
 * Mirrors the NestJS SearchApiExceptionFilter.catch() behaviour:
 * all known SearchExceptionCodes are re-thrown as-is (no transformation).
 * Unknown codes call assertUnreachable so TypeScript exhaustiveness checking
 * catches missing cases at compile time.
 */
export function handleSearchException(exception: SearchException): never {
  switch (exception.code) {
    case SearchExceptionCode.LABEL_IDENTIFIER_FIELD_NOT_FOUND:
    case SearchExceptionCode.OBJECT_METADATA_NOT_FOUND:
      throw exception;
    default: {
      assertUnreachable(exception.code);
    }
  }
}

// Class surface for consumers that import SearchApiExceptionFilter by name.
export class SearchApiExceptionFilter {
  catch(exception: SearchException): never {
    return handleSearchException(exception);
  }
}
