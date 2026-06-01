import { inspect } from 'util';

import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/common-query-runner.exception';

export const validateNumberFieldOrThrow = (
  value: unknown,
  fieldName: string,
): number | null => {
  if (
    (typeof value !== 'number' && value !== null) ||
    (typeof value === 'number' &&
      (isNaN(value) || value === Infinity || value === -Infinity))
  ) {
    const inspectedValue = inspect(value);

    throw new CommonQueryRunnerException(
      `Invalid number value ${inspectedValue} for field "${fieldName}"`,
      CommonQueryRunnerExceptionCode.INVALID_ARGS_DATA,
      {
        userFriendlyMessage: `Invalid value for number: "${inspectedValue}"`,
      },
    );
  }

  return value as number | null;
};
