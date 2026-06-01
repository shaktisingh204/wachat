import { inspect } from 'util';

import { isValidUuid } from '@/lib/sabcrm/shared/src/utils/validation/isValidUuid';

import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/common-query-runner.exception';

export const validateUUIDFieldOrThrow = (
  value: unknown,
  fieldName: string,
): string | null => {
  const isNonEmptyString =
    typeof value === 'string' && value.length > 0;

  if (
    (!isNonEmptyString && value !== null) ||
    (isNonEmptyString && !isValidUuid(value as string))
  ) {
    const inspectedValue = inspect(value);

    throw new CommonQueryRunnerException(
      `Invalid UUID value ${inspectedValue} for field "${fieldName}"`,
      CommonQueryRunnerExceptionCode.INVALID_ARGS_DATA,
      {
        userFriendlyMessage: `Invalid value for UUID: "${inspectedValue}"`,
      },
    );
  }

  return value as string;
};
