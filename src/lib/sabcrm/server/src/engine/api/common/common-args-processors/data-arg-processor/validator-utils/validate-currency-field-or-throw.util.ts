import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/common-query-runner.exception';
import { validateNumericFieldOrThrow } from '@/lib/sabcrm/server/src/engine/api/common/common-args-processors/data-arg-processor/validator-utils/validate-numeric-field-or-throw.util';
import { validateRawJsonFieldOrThrow } from '@/lib/sabcrm/server/src/engine/api/common/common-args-processors/data-arg-processor/validator-utils/validate-raw-json-field-or-throw.util';
import { validateTextFieldOrThrow } from '@/lib/sabcrm/server/src/engine/api/common/common-args-processors/data-arg-processor/validator-utils/validate-text-field-or-throw.util';

export const validateCurrencyFieldOrThrow = (
  value: unknown,
  fieldName: string,
): {
  amountMicros?: number | string | null;
  currencyCode?: string | null;
} | null => {
  const preValidatedValue = validateRawJsonFieldOrThrow(value, fieldName);

  if (preValidatedValue === null) return null;

  for (const [subField, subFieldValue] of Object.entries(preValidatedValue)) {
    switch (subField) {
      case 'amountMicros':
        validateNumericFieldOrThrow(subFieldValue, `${fieldName}.${subField}`);
        break;
      case 'currencyCode':
        validateTextFieldOrThrow(subFieldValue, `${fieldName}.${subField}`);
        break;
      default:
        throw new CommonQueryRunnerException(
          `Invalid subfield ${subField} for currency field "${fieldName}"`,
          CommonQueryRunnerExceptionCode.INVALID_ARGS_DATA,
          { userFriendlyMessage: 'Invalid value for currency.' },
        );
    }
  }

  return value as {
    amountMicros?: number | string | null;
    currencyCode?: string | null;
  };
};
