import { inspect } from 'util';

import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/common-query-runner.exception';

export const validateArrayFieldOrThrow = (
  value: unknown,
  fieldName: string,
): string | string[] | null => {
  if (value === null) return null;

  if (typeof value === 'string') return value;

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    const inspectedValue = inspect(value);

    throw new CommonQueryRunnerException(
      `Invalid value ${inspectedValue} for field "${fieldName} - Array values need to be string"`,
      CommonQueryRunnerExceptionCode.INVALID_ARGS_DATA,
      { userFriendlyMessage: `Invalid value: "${inspectedValue}"` },
    );
  }

  return value;
};
