import { inspect } from 'util';

import { isNull, isObject } from '@sniptt/guards';

import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from 'src/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/common-query-runner.exception';

export const validateRawJsonFieldOrThrow = (
  value: unknown,
  fieldName: string,
): object | string | null => {
  if (isNull(value)) return null;

  if (typeof value === 'string') {
    try {
      JSON.parse(value);
    } catch {
      throw new CommonQueryRunnerException(
        `Invalid object value ${inspect(value)} for field "${fieldName}"`,
        CommonQueryRunnerExceptionCode.INVALID_ARGS_DATA,
        { userFriendlyMessage: 'Invalid value for JSON.' },
      );
    }

    return value;
  }

  if (!isObject(value)) {
    const inspectedValue = inspect(value);

    throw new CommonQueryRunnerException(
      `Invalid object value ${inspectedValue} for field "${fieldName}"`,
      CommonQueryRunnerExceptionCode.INVALID_ARGS_DATA,
      { userFriendlyMessage: `Invalid value for JSON: "${inspectedValue}"` },
    );
  }

  return value;
};
