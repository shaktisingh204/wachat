import { FieldMetadataType } from 'src/lib/sabcrm/shared/src/types/FieldMetadataType';

// assertUnreachable: throws at runtime if a value that should be unreachable is reached
function assertUnreachable(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}

export const parseNumberValue = (
  value: unknown,
  fieldType:
    | FieldMetadataType.NUMBER
    | FieldMetadataType.NUMERIC
    | FieldMetadataType.POSITION,
): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  switch (fieldType) {
    case FieldMetadataType.NUMBER:
    case FieldMetadataType.NUMERIC:
    case FieldMetadataType.POSITION:
      return parseFloat(value);

    default:
      assertUnreachable(fieldType);
  }
};
