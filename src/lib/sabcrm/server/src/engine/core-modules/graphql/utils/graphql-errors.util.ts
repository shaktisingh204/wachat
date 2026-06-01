// PORT-NOTE: Ported from twenty-server/src/engine/core-modules/graphql/utils/graphql-errors.util.ts.
// GraphQLError base removed; replaced with plain Error subclasses carrying a code property,
// since this runs in Next.js (no GraphQL Yoga runtime in this context).

import { CustomException } from '@/lib/sabcrm/server/src/utils/custom-exception';

export enum ErrorCode {
  GRAPHQL_PARSE_FAILED = 'GRAPHQL_PARSE_FAILED',
  GRAPHQL_VALIDATION_FAILED = 'GRAPHQL_VALIDATION_FAILED',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  PERSISTED_QUERY_NOT_FOUND = 'PERSISTED_QUERY_NOT_FOUND',
  PERSISTED_QUERY_NOT_SUPPORTED = 'PERSISTED_QUERY_NOT_SUPPORTED',
  BAD_USER_INPUT = 'BAD_USER_INPUT',
  NOT_FOUND = 'NOT_FOUND',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  CONFLICT = 'CONFLICT',
  TIMEOUT = 'TIMEOUT',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  METADATA_VALIDATION_FAILED = 'METADATA_VALIDATION_FAILED',
  APPLICATION_INSTALLATION_FAILED = 'APPLICATION_INSTALLATION_FAILED',
}

export class BaseApiError extends Error {
  code: ErrorCode;
  subCode?: string;
  userFriendlyMessage?: string;

  constructor(
    messageOrException: string | CustomException,
    code: ErrorCode,
    extensions?: { userFriendlyMessage?: string; subCode?: string },
  ) {
    if (messageOrException instanceof CustomException) {
      super(messageOrException.message);
      this.subCode = messageOrException.code;
      this.userFriendlyMessage = messageOrException.userFriendlyMessage;
    } else {
      super(messageOrException);
      this.subCode = extensions?.subCode;
      this.userFriendlyMessage = extensions?.userFriendlyMessage;
    }
    this.code = code;
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends BaseApiError {
  constructor(
    messageOrException: string | CustomException,
    extensions?: { userFriendlyMessage?: string },
  ) {
    super(messageOrException, ErrorCode.NOT_FOUND, extensions);
  }
}

export class AuthenticationError extends BaseApiError {
  constructor(
    messageOrException: string | CustomException,
    extensions?: { userFriendlyMessage?: string },
  ) {
    super(messageOrException, ErrorCode.UNAUTHENTICATED, extensions);
  }
}

export class ForbiddenError extends BaseApiError {
  constructor(
    messageOrException: string | CustomException,
    extensions?: { userFriendlyMessage?: string },
  ) {
    super(messageOrException, ErrorCode.FORBIDDEN, extensions);
  }
}

export class UserInputError extends BaseApiError {
  constructor(
    messageOrException: string | CustomException,
    extensions?: { userFriendlyMessage?: string; isExpected?: boolean },
  ) {
    super(messageOrException, ErrorCode.BAD_USER_INPUT, extensions);
  }
}

export class MethodNotAllowedError extends BaseApiError {
  constructor(
    messageOrException: string | CustomException,
    extensions?: { userFriendlyMessage?: string },
  ) {
    super(messageOrException, ErrorCode.METHOD_NOT_ALLOWED, extensions);
  }
}

export class ConflictError extends BaseApiError {
  constructor(
    messageOrException: string | CustomException,
    extensions?: { userFriendlyMessage?: string },
  ) {
    super(messageOrException, ErrorCode.CONFLICT, extensions);
  }
}

export class TimeoutError extends BaseApiError {
  constructor(
    messageOrException: string | CustomException,
    extensions?: { userFriendlyMessage?: string },
  ) {
    super(messageOrException, ErrorCode.TIMEOUT, extensions);
  }
}

export class InternalServerError extends BaseApiError {
  constructor(
    messageOrException: string | CustomException,
    extensions?: { userFriendlyMessage?: string },
  ) {
    super(messageOrException, ErrorCode.INTERNAL_SERVER_ERROR, extensions);
  }
}

export class ValidationError extends BaseApiError {
  constructor(
    message: string,
    extensions?: { userFriendlyMessage?: string },
  ) {
    super(message, ErrorCode.GRAPHQL_VALIDATION_FAILED, extensions);
  }
}
