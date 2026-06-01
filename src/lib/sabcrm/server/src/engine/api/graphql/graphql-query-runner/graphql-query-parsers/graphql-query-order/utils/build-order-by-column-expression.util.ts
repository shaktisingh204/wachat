import { FieldMetadataType } from "@/lib/sabcrm/shared/src/types/field-metadata-type";

export const shouldUseCaseInsensitiveOrder = (
  fieldType: FieldMetadataType,
): boolean => {
  return (
    fieldType === FieldMetadataType.TEXT ||
    fieldType === FieldMetadataType.SELECT ||
    fieldType === FieldMetadataType.MULTI_SELECT
  );
};

export const shouldCastToText = (fieldType: FieldMetadataType): boolean => {
  return (
    fieldType === FieldMetadataType.SELECT ||
    fieldType === FieldMetadataType.MULTI_SELECT
  );
};

// Returns unquoted column expression (e.g., "company.name")
// Quoting and LOWER() wrapping is handled separately in the query builder.
export const buildOrderByColumnExpression = (
  prefix: string,
  columnName: string,
): string => {
  return `${prefix}.${columnName}`;
};
