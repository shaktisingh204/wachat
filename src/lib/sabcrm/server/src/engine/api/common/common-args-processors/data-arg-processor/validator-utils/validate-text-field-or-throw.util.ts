import { inspect } from 'util';

import { isNull } from '@sniptt/guards';

import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from 'src/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/common-query-runner.exception';

export const validateTextFieldOrThrow = (
  value: unknown,
  fieldName: string,
): string | null => {
  if (typeof value !== 'string' && !isNull(value)) {
    const inspectedValue = inspect(value);

    throw new CommonQueryRunnerException(
      `Invalid string value ${inspectedValue} for text field "${fieldName}"`,
      CommonQueryRunnerExceptionCode.INVALID_ARGS_DATA,
      { userFriendlyMessage: `Invalid value: "${inspectedValue}"` },
    );
  }

  return value;
};
