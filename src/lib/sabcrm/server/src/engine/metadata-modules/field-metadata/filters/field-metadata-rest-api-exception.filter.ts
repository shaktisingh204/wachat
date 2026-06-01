// PORT-NOTE: NestJS ExceptionFilter / @Catch decorators have no Next.js
// equivalent. This module exports a plain function that performs the same
// exception-type routing, mapping exceptions to HTTP status codes and JSON
// error bodies. Use it inside Next.js Route Handlers (app/api/**) instead of
// the NestJS filter.

import { type NextResponse } from "next/server";

import { FieldMetadataException } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/field-metadata.exception";
import { fieldMetadataExceptionCodeToHttpStatus } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/utils/field-metadata-exception-code-to-http-status.util";

// Lightweight stand-ins for the external exception types that the original
// filter catches. They are matched by name so callers can sub-class as needed.
export class InvalidMetadataException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMetadataException";
  }
}

export class WorkspaceMigrationBuilderException extends Error {
  // PORT-NOTE: The original carries a rich report payload. Simplified to a
  // string message here; the workspace-migration port owns the full type.
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceMigrationBuilderException";
  }
}

export class RestInputRequestParserException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestInputRequestParserException";
  }
}

export class FlatEntityMapsException extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "FlatEntityMapsException";
    this.code = code;
  }
}

type HandlerResult = {
  status: number;
  body: { error: string; code?: string; userFriendlyMessage?: string };
};

/**
 * Maps an exception thrown in a field-metadata REST handler to the appropriate
 * HTTP status + error body. Returns `null` for unknown exceptions (let the
 * caller decide how to handle those).
 */
export function handleFieldMetadataRestApiException(
  exception: unknown,
): HandlerResult | null {
  if (exception instanceof WorkspaceMigrationBuilderException) {
    return {
      status: 400,
      body: { error: exception.message, code: "WORKSPACE_MIGRATION_BUILDER_ERROR" },
    };
  }

  if (
    exception instanceof InvalidMetadataException ||
    exception instanceof RestInputRequestParserException
  ) {
    return { status: 400, body: { error: exception.message } };
  }

  if (exception instanceof FlatEntityMapsException) {
    // PORT-NOTE: flatEntityMapsExceptionCodeToHttpStatus is ported separately;
    // default to 400 until that util is available.
    return {
      status: 400,
      body: { error: exception.message, code: exception.code },
    };
  }

  if (exception instanceof FieldMetadataException) {
    const status = fieldMetadataExceptionCodeToHttpStatus(exception.code);
    return {
      status,
      body: {
        error: exception.message,
        code: exception.code,
        userFriendlyMessage: exception.userFriendlyMessage,
      },
    };
  }

  return null;
}

/**
 * Convenience wrapper for use in Next.js Route Handlers.
 * Import `NextResponse` from 'next/server' in the call site.
 */
export function buildFieldMetadataErrorResponse(
  exception: unknown,
  nextResponse: typeof NextResponse,
): ReturnType<typeof NextResponse.json> {
  const result = handleFieldMetadataRestApiException(exception);

  if (result) {
    return nextResponse.json(result.body, { status: result.status });
  }

  // Unhandled / unknown exception
  const message =
    exception instanceof Error ? exception.message : "Internal server error";
  return nextResponse.json({ error: message }, { status: 500 });
}
