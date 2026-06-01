import { isDefined } from '@/lib/sabcrm/shared/src/utils/validation/isDefined';

import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/common-query-runner.exception';
import { STANDARD_ERROR_MESSAGE } from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/standard-error-message.constant';
import { validateTextFieldOrThrow } from '@/lib/sabcrm/server/src/engine/api/common/common-args-processors/data-arg-processor/validator-utils/validate-text-field-or-throw.util';

export const validateRatingAndSelectFieldOrThrow = (
  value: unknown,
  fieldName: string,
  options?: string[],
): string | null => {
  const preValidatedValue = validateTextFieldOrThrow(value, fieldName);

  if (!isDefined(options)) {
    throw new CommonQueryRunnerException(
      `Invalid options for field "${fieldName}"`,
      CommonQueryRunnerExceptionCode.INVALID_ARGS_DATA,
      { userFriendlyMessage: STANDARD_ERROR_MESSAGE },
    );
  }

  if (preValidatedValue !== null && !options.includes(preValidatedValue)) {
    throw new CommonQueryRunnerException(
      `Invalid value "${preValidatedValue}" for field "${fieldName}". Valid values are: ${options.join(', ')}`,
      CommonQueryRunnerExceptionCode.INVALID_ARGS_DATA,
      {
        userFriendlyMessage: `Invalid value for field "${fieldName}"`,
      },
    );
  }

  return preValidatedValue;
};
