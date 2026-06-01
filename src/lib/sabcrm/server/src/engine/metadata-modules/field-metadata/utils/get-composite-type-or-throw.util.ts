// PORT-NOTE: Ported from twenty-server. NestJS removed; plain TypeScript.
// Uses shared compositeTypeDefinitions and the ported FieldMetadataException.

import { type CompositeType } from '@/lib/sabcrm/shared/src/types/composite-types/composite-type.interface';
import { compositeTypeDefinitions } from '@/lib/sabcrm/shared/src/types/composite-types/composite-type-definitions';
import { type FieldMetadataType } from '@/lib/sabcrm/shared/src/types/FieldMetadataType';

import {
  FieldMetadataException,
  FieldMetadataExceptionCode,
} from '@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/field-metadata.exception';

export const getCompositeTypeOrThrow = (
  fieldType: FieldMetadataType,
): CompositeType => {
  const compositeType = compositeTypeDefinitions.get(fieldType);

  if (!compositeType) {
    throw new FieldMetadataException(
      `Composite type not found for field metadata type: ${fieldType}`,
      FieldMetadataExceptionCode.UNCOVERED_FIELD_METADATA_TYPE_VALIDATION,
    );
  }

  return compositeType;
};
