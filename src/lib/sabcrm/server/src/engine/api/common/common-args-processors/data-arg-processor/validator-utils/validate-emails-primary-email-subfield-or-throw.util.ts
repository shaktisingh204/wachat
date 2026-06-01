import { inspect } from 'util';

import { isNonEmptyString, isNull } from '@sniptt/guards';
import { z } from 'zod';

import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from 'src/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/common-query-runner.exception';

export const validateEmailsPrimaryEmailSubfieldOrThrow = (
  value: unknown,
  fieldName: string,
): string | null => {
  if (isNull(value)) return null;

  if (typeof value !== 'string') {
    const inspectedValue = inspect(value);

    throw new CommonQueryRunnerException(
      `Invalid string value ${inspectedValue} for email field "${fieldName}"`,
      CommonQueryRunnerExceptionCode.INVALID_ARGS_DATA,
      { userFriendlyMessage: `Invalid value: "${inspectedValue}"` },
    );
  }

  if (
    !z.string().email().safeParse(value).success &&
    isNonEmptyString(value)
  ) {
    const inspectedValue = inspect(value);

    throw new CommonQueryRunnerException(
      `Invalid string value ${inspectedValue} for email field "${fieldName}"`,
      CommonQueryRunnerExceptionCode.INVALID_ARGS_DATA,
      { userFriendlyMessage: `Invalid value: "${inspectedValue}"` },
    );
  }

  return value;
};
