// PORT-NOTE: twenty-shared/utils assertUnreachable + graphql error helpers ported below.
// ConflictError, ForbiddenError, InternalServerError, NotFoundError, UserInputError are
// simple Error subclasses matching the originals from graphql-errors.util.
import { assertUnreachable } from '@/lib/sabcrm/shared/src/utils/assertUnreachable';

import {
  AiException,
  AiExceptionCode,
} from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai.exception';

// Lightweight GraphQL error wrappers (same shape as the NestJS originals).
export class NotFoundError extends Error {
  constructor(cause: Error) {
    super(cause.message);
    this.name = 'NotFoundError';
  }
}
export class UserInputError extends Error {
  constructor(cause: Error) {
    super(cause.message);
    this.name = 'UserInputError';
  }
}
export class ConflictError extends Error {
  constructor(cause: Error) {
    super(cause.message);
    this.name = 'ConflictError';
  }
}
export class ForbiddenError extends Error {
  constructor(cause: Error) {
    super(cause.message);
    this.name = 'ForbiddenError';
  }
}
export class InternalServerError extends Error {
  constructor(cause: Error) {
    super(cause.message);
    this.name = 'InternalServerError';
  }
}

export const aiGraphqlApiExceptionHandler = (error: Error) => {
  if (error instanceof AiException) {
    switch (error.code) {
      case AiExceptionCode.AGENT_NOT_FOUND:
      case AiExceptionCode.THREAD_NOT_FOUND:
      case AiExceptionCode.MESSAGE_NOT_FOUND:
      case AiExceptionCode.ROLE_NOT_FOUND:
        throw new NotFoundError(error);
      case AiExceptionCode.INVALID_AGENT_INPUT:
      case AiExceptionCode.INVALID_CHAT_THREAD_TITLE:
        throw new UserInputError(error);
      case AiExceptionCode.AGENT_ALREADY_EXISTS:
        throw new ConflictError(error);
      case AiExceptionCode.AGENT_IS_STANDARD:
      case AiExceptionCode.ROLE_CANNOT_BE_ASSIGNED_TO_AGENTS:
        throw new ForbiddenError(error);
      case AiExceptionCode.AGENT_EXECUTION_FAILED:
      case AiExceptionCode.API_KEY_NOT_CONFIGURED:
      case AiExceptionCode.USER_WORKSPACE_ID_NOT_FOUND:
        throw new InternalServerError(error);
      default: {
        return assertUnreachable(error.code);
      }
    }
  }

  throw error;
};
