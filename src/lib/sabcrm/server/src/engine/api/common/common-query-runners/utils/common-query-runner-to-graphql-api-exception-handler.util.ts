import "server-only";

// PORT-NOTE: Ported from Twenty's common-query-runner-to-graphql-api-exception-handler.util.ts.
// Maps CommonQueryRunnerException codes to GraphQL-safe error types.
// assertUnreachable from shared utils preserves exhaustive switch coverage.

import { assertUnreachable } from '@/lib/sabcrm/shared/src/utils/assertUnreachable';
import {
  type CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/common-query-runner.exception';
import {
  AuthenticationError,
  InternalServerError,
  NotFoundError,
  UserInputError,
} from '@/lib/sabcrm/server/src/engine/core-modules/graphql/utils/graphql-errors.util';

export const commonQueryRunnerToGraphqlApiExceptionHandler = (
  error: CommonQueryRunnerException,
): never => {
  switch (error.code) {
    case CommonQueryRunnerExceptionCode.RECORD_NOT_FOUND:
      throw new NotFoundError(error.message);
    case CommonQueryRunnerExceptionCode.ARGS_CONFLICT:
    case CommonQueryRunnerExceptionCode.INVALID_ARGS_FIRST:
    case CommonQueryRunnerExceptionCode.INVALID_ARGS_LAST:
    case CommonQueryRunnerExceptionCode.INVALID_QUERY_INPUT:
    case CommonQueryRunnerExceptionCode.INVALID_ARGS_DATA:
    case CommonQueryRunnerExceptionCode.INVALID_ARGS_FILTER:
    case CommonQueryRunnerExceptionCode.UPSERT_MULTIPLE_MATCHING_RECORDS_CONFLICT:
    case CommonQueryRunnerExceptionCode.INVALID_CURSOR:
    case CommonQueryRunnerExceptionCode.TOO_MANY_RECORDS_TO_UPDATE:
    case CommonQueryRunnerExceptionCode.BAD_REQUEST:
    case CommonQueryRunnerExceptionCode.TOO_COMPLEX_QUERY:
    case CommonQueryRunnerExceptionCode.MISSING_TIMEZONE_FOR_DATE_GROUP_BY:
    case CommonQueryRunnerExceptionCode.INVALID_TIMEZONE:
      throw new UserInputError(error.message);
    case CommonQueryRunnerExceptionCode.INVALID_AUTH_CONTEXT:
      throw new AuthenticationError(error.message);
    case CommonQueryRunnerExceptionCode.MISSING_SYSTEM_FIELD:
    case CommonQueryRunnerExceptionCode.INTERNAL_SERVER_ERROR:
      throw new InternalServerError(error.message);
    default:
      return assertUnreachable(error.code);
  }
};
