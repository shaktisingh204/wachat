// PORT: server-logic
// Original: NestJS @Catch(WorkflowTriggerException) ExceptionFilter for REST routes.
// In Next.js/SabNode there is no NestJS HTTP adapter; this module exports a plain
// function that converts a WorkflowTriggerException to an HTTP status code so that
// Next.js Route Handler callers can return Response objects with the right status.

import {
  WorkflowTriggerException,
  WorkflowTriggerExceptionCode,
} from '@/lib/sabcrm/server/src/engine/core-modules/workflow/filters/workflow-trigger-graphql-api-exception.filter';

export type WorkflowTriggerHttpError = {
  statusCode: number;
  message: string;
  code: WorkflowTriggerExceptionCode;
};

/**
 * Map a WorkflowTriggerException to an HTTP status code and structured payload.
 * Use this inside Next.js Route Handlers that expose workflow trigger endpoints.
 *
 * @example
 * try { ... } catch (err) {
 *   if (err instanceof WorkflowTriggerException) {
 *     const { statusCode, ...body } = mapWorkflowTriggerExceptionToHttp(err);
 *     return NextResponse.json(body, { status: statusCode });
 *   }
 *   throw err;
 * }
 */
export function mapWorkflowTriggerExceptionToHttp(
  exception: WorkflowTriggerException,
): WorkflowTriggerHttpError {
  let statusCode: number;

  switch (exception.code) {
    case WorkflowTriggerExceptionCode.INVALID_INPUT:
    case WorkflowTriggerExceptionCode.INVALID_WORKFLOW_TRIGGER:
    case WorkflowTriggerExceptionCode.INVALID_WORKFLOW_VERSION:
    case WorkflowTriggerExceptionCode.INVALID_ACTION_TYPE:
    case WorkflowTriggerExceptionCode.INVALID_WORKFLOW_STATUS:
      statusCode = 400;
      break;
    case WorkflowTriggerExceptionCode.FORBIDDEN:
      statusCode = 403;
      break;
    case WorkflowTriggerExceptionCode.NOT_FOUND:
      statusCode = 404;
      break;
    case WorkflowTriggerExceptionCode.INTERNAL_ERROR:
    default:
      statusCode = 500;
      break;
  }

  return { statusCode, message: exception.message, code: exception.code };
}
