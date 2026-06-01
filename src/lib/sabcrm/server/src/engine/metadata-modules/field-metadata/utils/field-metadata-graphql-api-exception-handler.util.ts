// PORT-NOTE: NestJS GraphQL error classes (ConflictError, ForbiddenError, etc.)
// are replaced with plain Error subclasses. assertUnreachable is inlined.
// WorkspaceMigrationBuilderException and InvalidMetadataException are matched
// by name since the full class hierarchy lives in separate ported modules.
// Logic ported verbatim.

import {
  FieldMetadataException,
  FieldMetadataExceptionCode,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/field-metadata.exception";

// ---------------------------------------------------------------------------
// Lightweight replacements for NestJS GraphQL error types
// ---------------------------------------------------------------------------

export class NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(cause: Error) {
    super(cause.message);
    this.name = "NotFoundError";
  }
}

export class UserInputError extends Error {
  readonly statusCode = 400;
  constructor(cause: Error) {
    super(cause.message);
    this.name = "UserInputError";
  }
}

export class ForbiddenError extends Error {
  readonly statusCode = 403;
  constructor(cause: Error) {
    super(cause.message);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends Error {
  readonly statusCode = 409;
  constructor(cause: Error) {
    super(cause.message);
    this.name = "ConflictError";
  }
}

// ---------------------------------------------------------------------------
// Inline assertUnreachable
// ---------------------------------------------------------------------------

function assertUnreachable(_value: never): never {
  throw new Error(
    `Unhandled FieldMetadataExceptionCode: ${String(_value)}`,
  );
}

// ---------------------------------------------------------------------------
// Exception handler
// ---------------------------------------------------------------------------

export const fieldMetadataGraphqlApiExceptionHandler = (error: Error): never => {
  // WorkspaceMigrationBuilderException is matched by name to avoid circular
  // imports from the workspace-migration port.
  if (error.name === "WorkspaceMigrationBuilderException") {
    // Re-throw as UserInputError so callers get a structured 400.
    throw new UserInputError(error);
  }

  if (error.name === "InvalidMetadataException") {
    throw new UserInputError(error);
  }

  if (error instanceof FieldMetadataException) {
    switch (error.code) {
      case FieldMetadataExceptionCode.FIELD_METADATA_NOT_FOUND:
        throw new NotFoundError(error);
      case FieldMetadataExceptionCode.INVALID_FIELD_INPUT:
        throw new UserInputError(error);
      case FieldMetadataExceptionCode.FIELD_MUTATION_NOT_ALLOWED:
        throw new ForbiddenError(error);
      case FieldMetadataExceptionCode.FIELD_ALREADY_EXISTS:
        throw new ConflictError(error);
      case FieldMetadataExceptionCode.OBJECT_METADATA_NOT_FOUND:
      case FieldMetadataExceptionCode.APPLICATION_NOT_FOUND:
      case FieldMetadataExceptionCode.INTERNAL_SERVER_ERROR:
      case FieldMetadataExceptionCode.FIELD_METADATA_RELATION_NOT_ENABLED:
      case FieldMetadataExceptionCode.FIELD_METADATA_RELATION_MALFORMED:
      case FieldMetadataExceptionCode.UNCOVERED_FIELD_METADATA_TYPE_VALIDATION:
      case FieldMetadataExceptionCode.LABEL_IDENTIFIER_FIELD_METADATA_ID_NOT_FOUND:
      case FieldMetadataExceptionCode.RESERVED_KEYWORD:
      case FieldMetadataExceptionCode.NOT_AVAILABLE:
      case FieldMetadataExceptionCode.NAME_NOT_SYNCED_WITH_LABEL:
        throw error;
      default: {
        return assertUnreachable(error.code);
      }
    }
  }

  throw error;
};
