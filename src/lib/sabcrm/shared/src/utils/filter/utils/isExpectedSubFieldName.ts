import { COMPOSITE_FIELD_TYPE_SUB_FIELDS_NAMES } from '@/lib/sabcrm/shared/src/constants/CompositeFieldTypeSubFieldsNames';
import { type CompositeFieldSubFieldName } from '@/lib/sabcrm/shared/src/types/CompositeFieldSubFieldNameType';

type CompositeMap = typeof COMPOSITE_FIELD_TYPE_SUB_FIELDS_NAMES;

export const isExpectedSubFieldName = <
  TFieldMetadataType extends keyof CompositeMap,
  TPossibleSubFieldName extends CompositeFieldSubFieldName,
>(
  fieldMetadataType: TFieldMetadataType,
  subFieldName: TPossibleSubFieldName,
  subFieldNameToCheck: string | null | undefined,
): subFieldNameToCheck is TPossibleSubFieldName => {
  const allowedSubFields = Object.values(
    COMPOSITE_FIELD_TYPE_SUB_FIELDS_NAMES[fieldMetadataType],
  ) as readonly string[];

  return (
    allowedSubFields.includes(subFieldName as string) &&
    subFieldName === subFieldNameToCheck
  );
};
