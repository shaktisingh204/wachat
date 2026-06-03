import { LABEL_IDENTIFIER_FIELD_METADATA_TYPES } from '@/lib/sabcrm/shared/src/constants/LabelIdentifierFieldMetadataTypes';
import { type FieldMetadataType } from '@/lib/sabcrm/shared/src/types/FieldMetadataType';

export const isLabelIdentifierFieldMetadataTypes = (
  value: FieldMetadataType,
): value is (typeof LABEL_IDENTIFIER_FIELD_METADATA_TYPES)[number] =>
  LABEL_IDENTIFIER_FIELD_METADATA_TYPES.includes(value);
