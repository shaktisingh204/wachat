// PORT-NOTE: NestJS @Catch / ExceptionFilter / ArgumentsHost dropped.
// In Next.js there is no NestJS exception filter mechanism; this module
// exports a plain handler function that API route handlers call inside a
// try/catch to map AiException codes to HTTP status codes.

import {
  AiException,
  AiExceptionCode,
} from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai.exception';

export type HttpErrorResponse = {
  status: number;
  message: string;
  code: AiExceptionCode;
};

export const handleAiRestApiException = (
  exception: AiException,
): HttpErrorResponse => {
  const base = {
    message: exception.userFriendlyMessage,
    code: exception.code,
  };

  switch (exception.code) {
    case AiExceptionCode.AGENT_NOT_FOUND:
    case AiExceptionCode.THREAD_NOT_FOUND:
    case AiExceptionCode.MESSAGE_NOT_FOUND:
    case AiExceptionCode.USER_WORKSPACE_ID_NOT_FOUND:
    case AiExceptionCode.ROLE_NOT_FOUND:
      return { ...base, status: 404 };
    case AiExceptionCode.API_KEY_NOT_CONFIGURED:
      // Service Unavailable — the AI service is not configured.
      return { ...base, status: 503 };
    case AiExceptionCode.AGENT_EXECUTION_FAILED:
    case AiExceptionCode.ROLE_CANNOT_BE_ASSIGNED_TO_AGENTS:
    case AiExceptionCode.INVALID_AGENT_INPUT:
    case AiExceptionCode.AGENT_ALREADY_EXISTS:
    case AiExceptionCode.AGENT_IS_STANDARD:
      return { ...base, status: 400 };
    default:
      return { ...base, status: 500 };
  }
};
