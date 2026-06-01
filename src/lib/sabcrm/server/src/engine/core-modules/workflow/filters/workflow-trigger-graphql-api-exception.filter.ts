// PORT: server-logic
// Original: NestJS @Catch(WorkflowTriggerException) ExceptionFilter
// In Next.js there is no NestJS exception filter mechanism; this module exports
// a plain handler function that callers (server actions / API routes) invoke
// inside a try/catch to re-throw with the correct HTTP/GraphQL error shape.

export enum WorkflowTriggerExceptionCode {
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_WORKFLOW_TRIGGER = 'INVALID_WORKFLOW_TRIGGER',
  INVALID_WORKFLOW_VERSION = 'INVALID_WORKFLOW_VERSION',
  INVALID_WORKFLOW_STATUS = 'INVALID_WORKFLOW_STATUS',
  INVALID_ACTION_TYPE = 'INVALID_ACTION_TYPE',
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class WorkflowTriggerException extends Error {
  constructor(
    message: string,
    public readonly code: WorkflowTriggerExceptionCode,
  ) {
    super(message);
    this.name = 'WorkflowTriggerException';
  }
}

// Error shapes aligned with SabNode API conventions
export class UserInputError extends Error {
  readonly statusCode = 400;
  constructor(cause: Error) {
    super(cause.message);
    this.name = 'UserInputError';
  }
}

export class NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(cause: Error) {
    super(cause.message);
    this.name = 'NotFoundError';
  }
}

/**
 * Translate a WorkflowTriggerException into a typed API error.
 * Call this inside server actions / route handlers wrapping workflow trigger logic.
 */
export function handleWorkflowTriggerException(
  exception: WorkflowTriggerException,
): never {
  switch (exception.code) {
    case WorkflowTriggerExceptionCode.INVALID_INPUT:
    case WorkflowTriggerExceptionCode.INVALID_WORKFLOW_VERSION:
    case WorkflowTriggerExceptionCode.INVALID_ACTION_TYPE:
    case WorkflowTriggerExceptionCode.INVALID_WORKFLOW_TRIGGER:
    case WorkflowTriggerExceptionCode.INVALID_WORKFLOW_STATUS:
    case WorkflowTriggerExceptionCode.FORBIDDEN:
      throw new UserInputError(exception);
    case WorkflowTriggerExceptionCode.NOT_FOUND:
      throw new NotFoundError(exception);
    case WorkflowTriggerExceptionCode.INTERNAL_ERROR:
    default:
      throw exception;
  }
}
