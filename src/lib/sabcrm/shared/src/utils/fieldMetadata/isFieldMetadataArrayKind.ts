import { FieldMetadataType } from '@/lib/sabcrm/shared/src/types/FieldMetadataType';

export const isFieldMetadataArrayKind = (
  fieldMetadataType: FieldMetadataType,
): boolean => {
  return (
    fieldMetadataType === FieldMetadataType.MULTI_SELECT ||
    fieldMetadataType === FieldMetadataType.ARRAY
  );
};
