import { FieldMetadataType } from '@/lib/sabcrm/shared/src/types/FieldMetadataType';

export const isFieldMetadataSelectKind = (
  fieldMetadataType: FieldMetadataType,
): boolean => {
  return (
    fieldMetadataType === FieldMetadataType.SELECT ||
    fieldMetadataType === FieldMetadataType.MULTI_SELECT
  );
};
