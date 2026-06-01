import { FieldMetadataType } from 'src/lib/sabcrm/shared/src/types/FieldMetadataType';

import { validateBooleanFieldOrThrow } from 'src/lib/sabcrm/server/src/engine/api/common/common-args-processors/filter-arg-processor/validator-utils/validate-boolean-field-or-throw.util';
import { validateDateFieldOrThrow } from 'src/lib/sabcrm/server/src/engine/api/common/common-args-processors/filter-arg-processor/validator-utils/validate-date-field-or-throw.util';
import { validateDateTimeFieldOrThrow } from 'src/lib/sabcrm/server/src/engine/api/common/common-args-processors/filter-arg-processor/validator-utils/validate-date-time-field-or-throw.util';
import { validateNumberFieldOrThrow } from 'src/lib/sabcrm/server/src/engine/api/common/common-args-processors/filter-arg-processor/validator-utils/validate-number-field-or-throw.util';
import { validateUUIDFieldOrThrow } from 'src/lib/sabcrm/server/src/engine/api/common/common-args-processors/filter-arg-processor/validator-utils/validate-uuid-field-or-throw.util';
import { type FlatFieldMetadata } from 'src/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';

import { parseNumberValue } from './parse-number-value.util';

// Parse a boolean from a string value ("true"/"false")
const parseBooleanFromStringValue = (value: string): boolean | null => {
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return null;
};

export const validateAndTransformValueByFieldType = (
  value: unknown,
  fieldMetadata: FlatFieldMetadata,
  fieldName: string,
): unknown => {
  const fieldType = fieldMetadata.type;

  switch (fieldType) {
    case FieldMetadataType.NUMBER:
    case FieldMetadataType.NUMERIC:
    case FieldMetadataType.POSITION: {
      const coercedNumber = parseNumberValue(value, fieldType);

      validateNumberFieldOrThrow(coercedNumber, fieldName);

      return coercedNumber;
    }

    case FieldMetadataType.BOOLEAN: {
      const coercedBoolean =
        typeof value === 'string'
          ? parseBooleanFromStringValue(value.toString())
          : value;

      validateBooleanFieldOrThrow(coercedBoolean, fieldName);

      return coercedBoolean;
    }

    case FieldMetadataType.UUID:
    case FieldMetadataType.RELATION:
    case FieldMetadataType.MORPH_RELATION:
      validateUUIDFieldOrThrow(value, fieldName);

      return value;

    case FieldMetadataType.DATE:
      validateDateFieldOrThrow(value, fieldName);

      return value;

    case FieldMetadataType.DATE_TIME:
      validateDateTimeFieldOrThrow(value, fieldName);

      return value;

    default:
      return value;
  }
};
