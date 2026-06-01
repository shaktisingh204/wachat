import { inspect } from 'util';

import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from 'src/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/common-query-runner.exception';

export const validateOverriddenPositionFieldOrThrow = (
  value: unknown,
  fieldName: string,
): number | null => {
  if (
    typeof value !== 'number' ||
    (typeof value === 'number' &&
      (isNaN(value) || value === Infinity || value === -Infinity))
  ) {
    const inspectedValue = inspect(value);

    throw new CommonQueryRunnerException(
      `Invalid position value ${inspectedValue} for field "${fieldName}"`,
      CommonQueryRunnerExceptionCode.INVALID_ARGS_DATA,
      {
        userFriendlyMessage: `Invalid value for position: "${inspectedValue}"`,
      },
    );
  }

  return value;
};
