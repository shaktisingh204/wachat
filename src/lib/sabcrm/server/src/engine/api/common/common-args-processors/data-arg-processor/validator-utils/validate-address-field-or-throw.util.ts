import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/errors/common-query-runner.exception';
import { validateNumericFieldOrThrow } from '@/lib/sabcrm/server/src/engine/api/common/common-args-processors/data-arg-processor/validator-utils/validate-numeric-field-or-throw.util';
import { validateRawJsonFieldOrThrow } from '@/lib/sabcrm/server/src/engine/api/common/common-args-processors/data-arg-processor/validator-utils/validate-raw-json-field-or-throw.util';
import { validateTextFieldOrThrow } from '@/lib/sabcrm/server/src/engine/api/common/common-args-processors/data-arg-processor/validator-utils/validate-text-field-or-throw.util';

export const validateAddressFieldOrThrow = (
  value: unknown,
  fieldName: string,
): {
  addressStreet1?: string | null;
  addressStreet2?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostcode?: string | null;
  addressCountry?: string | null;
  addressLat?: number | null;
  addressLng?: number | null;
} | null => {
  const preValidatedValue = validateRawJsonFieldOrThrow(value, fieldName);

  if (preValidatedValue === null) return null;

  for (const [subField, subFieldValue] of Object.entries(preValidatedValue)) {
    switch (subField) {
      case 'addressStreet1':
        validateTextFieldOrThrow(subFieldValue, `${fieldName}.${subField}`);
        break;
      case 'addressStreet2':
        validateTextFieldOrThrow(subFieldValue, `${fieldName}.${subField}`);
        break;
      case 'addressCity':
        validateTextFieldOrThrow(subFieldValue, `${fieldName}.${subField}`);
        break;
      case 'addressState':
        validateTextFieldOrThrow(subFieldValue, `${fieldName}.${subField}`);
        break;
      case 'addressPostcode':
        validateTextFieldOrThrow(subFieldValue, `${fieldName}.${subField}`);
        break;
      case 'addressCountry':
        validateTextFieldOrThrow(subFieldValue, `${fieldName}.${subField}`);
        break;
      case 'addressLat':
        validateNumericFieldOrThrow(subFieldValue, `${fieldName}.${subField}`);
        break;
      case 'addressLng':
        validateNumericFieldOrThrow(subFieldValue, `${fieldName}.${subField}`);
        break;
      default:
        throw new CommonQueryRunnerException(
          `Invalid subfield ${subField} for address field "${fieldName}"`,
          CommonQueryRunnerExceptionCode.INVALID_ARGS_DATA,
          { userFriendlyMessage: 'Invalid value for address.' },
        );
    }
  }

  return value as {
    addressStreet1?: string | null;
    addressStreet2?: string | null;
    addressCity?: string | null;
    addressState?: string | null;
    addressPostcode?: string | null;
    addressCountry?: string | null;
    addressLat?: number | null;
    addressLng?: number | null;
  };
};
