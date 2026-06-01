// PORT: server-logic
// Original: NestJS @Catch(WorkflowVersionEdgeException) ExceptionFilter
// Ported as plain handler function; NestJS exception filter mechanism has no Next.js equivalent.

export enum WorkflowVersionEdgeExceptionCode {
  NOT_FOUND = 'NOT_FOUND',
  INVALID_REQUEST = 'INVALID_REQUEST',
}

export class WorkflowVersionEdgeException extends Error {
  constructor(
    message: string,
    public readonly code: WorkflowVersionEdgeExceptionCode,
  ) {
    super(message);
    this.name = 'WorkflowVersionEdgeException';
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

/**
 * Translate a WorkflowVersionEdgeException into a typed API error.
 * Call this inside server actions / route handlers wrapping workflow-version-edge logic.
 */
export function handleWorkflowVersionEdgeException(
  exception: WorkflowVersionEdgeException,
): never {
  switch (exception.code) {
    case WorkflowVersionEdgeExceptionCode.NOT_FOUND:
      throw new NotFoundError(exception);
    case WorkflowVersionEdgeExceptionCode.INVALID_REQUEST:
      throw new UserInputError(exception);
    default: {
      // exhaustive guard — TypeScript will warn if a new code is added without handling
      const _exhaustive: never = exception.code;
      throw exception;
    }
  }
}
