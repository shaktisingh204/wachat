// PORT-NOTE: Ported from twenty-server. NestJS @Catch / ExceptionFilter removed.
// In SabNode there is no NestJS GraphQL — this filter is a plain function that maps
// ConfigVariableException to structured error objects usable in API route handlers.

import {
  ConfigVariableException,
  ConfigVariableExceptionCode,
} from '@/lib/sabcrm/server/src/engine/core-modules/twenty-config/twenty-config.exception';

export type GraphqlApiError = {
  code: 'NOT_FOUND' | 'FORBIDDEN' | 'USER_INPUT' | 'INTERNAL';
  message: string;
};

/**
 * Maps a ConfigVariableException to a structured error object.
 * Use this in Next.js API route handlers / server actions instead of NestJS filters.
 */
export function mapConfigVariableException(
  exception: ConfigVariableException,
): GraphqlApiError {
  switch (exception.code) {
    case ConfigVariableExceptionCode.VARIABLE_NOT_FOUND:
      return { code: 'NOT_FOUND', message: exception.message };
    case ConfigVariableExceptionCode.ENVIRONMENT_ONLY_VARIABLE:
      return { code: 'FORBIDDEN', message: exception.message };
    case ConfigVariableExceptionCode.DATABASE_CONFIG_DISABLED:
    case ConfigVariableExceptionCode.VALIDATION_FAILED:
      return { code: 'USER_INPUT', message: exception.message };
    case ConfigVariableExceptionCode.INTERNAL_ERROR:
    case ConfigVariableExceptionCode.UNSUPPORTED_CONFIG_TYPE:
      return { code: 'INTERNAL', message: exception.message };
    default: {
      // Exhaustive check — TypeScript will error here if a new code is added without handling
      const _exhaustive: never = exception.code;

      return { code: 'INTERNAL', message: `Unhandled config exception: ${_exhaustive}` };
    }
  }
}
