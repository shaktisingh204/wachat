// PORT: server-logic
// Original: NestJS @Catch(WorkflowVersionStepException) ExceptionFilter
// Ported as plain handler function; NestJS exception filter mechanism has no Next.js equivalent.

export enum WorkflowVersionStepExceptionCode {
  INVALID_REQUEST = 'INVALID_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  CODE_STEP_FAILURE = 'CODE_STEP_FAILURE',
  AI_AGENT_STEP_FAILURE = 'AI_AGENT_STEP_FAILURE',
}

export class WorkflowVersionStepException extends Error {
  constructor(
    message: string,
    public readonly code: WorkflowVersionStepExceptionCode,
  ) {
    super(message);
    this.name = 'WorkflowVersionStepException';
  }
}

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

export class InternalServerError extends Error {
  readonly statusCode = 500;
  constructor(cause: Error) {
    super(cause.message);
    this.name = 'InternalServerError';
  }
}

/**
 * Translate a WorkflowVersionStepException into a typed API error.
 * Call this inside server actions / route handlers wrapping workflow step logic.
 */
export function handleWorkflowVersionStepException(
  exception: WorkflowVersionStepException,
): never {
  switch (exception.code) {
    case WorkflowVersionStepExceptionCode.INVALID_REQUEST:
      throw new UserInputError(exception);
    case WorkflowVersionStepExceptionCode.NOT_FOUND:
      throw new NotFoundError(exception);
    case WorkflowVersionStepExceptionCode.CODE_STEP_FAILURE:
    case WorkflowVersionStepExceptionCode.AI_AGENT_STEP_FAILURE:
      throw new InternalServerError(exception);
    default: {
      const _exhaustive: never = exception.code;
      throw exception;
    }
  }
}
