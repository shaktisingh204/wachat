import { inspect } from 'util';

import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/common-query-runner.exception';

export const validateBooleanFieldOrThrow = (
  value: unknown,
  fieldName: string,
): boolean | null => {
  if (typeof value !== 'boolean' && value !== null) {
    const inspectedValue = inspect(value);

    throw new CommonQueryRunnerException(
      `Invalid boolean value ${inspect(value)} for field "${fieldName}"`,
      CommonQueryRunnerExceptionCode.INVALID_ARGS_DATA,
      { userFriendlyMessage: `Invalid value: "${inspectedValue}"` },
    );
  }

  return value;
};
