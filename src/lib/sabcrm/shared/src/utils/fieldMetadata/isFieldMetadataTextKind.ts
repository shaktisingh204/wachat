import { FieldMetadataType } from '@/lib/sabcrm/shared/src/types/FieldMetadataType';

const TEXT_FIELD_TYPES: FieldMetadataType[] = [
  FieldMetadataType.TEXT,
  FieldMetadataType.RICH_TEXT,
];

export const isFieldMetadataTextKind = (
  fieldMetadataType: FieldMetadataType,
): boolean => {
  return TEXT_FIELD_TYPES.includes(fieldMetadataType);
};
