import { type FilterOperator } from 'src/lib/sabcrm/server/src/engine/api/common/common-args-processors/filter-arg-processor/types/filter-operator.type';
import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from 'src/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/common-query-runner.exception';

export const validateStringOperatorValueOrThrow = (
  value: unknown,
  operator: FilterOperator,
  fieldName: string,
): void => {
  if (typeof value !== 'string') {
    throw new CommonQueryRunnerException(
      `Filter operator "${operator}" requires a string value for field "${fieldName}", got ${typeof value}`,
      CommonQueryRunnerExceptionCode.INVALID_ARGS_FILTER,
      {
        userFriendlyMessage: `Invalid filter: "${operator}" operator requires a String`,
      },
    );
  }
};
