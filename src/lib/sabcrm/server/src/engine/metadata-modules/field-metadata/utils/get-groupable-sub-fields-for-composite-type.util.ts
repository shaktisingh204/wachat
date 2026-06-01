// PORT-NOTE: Ported from twenty-server. NestJS removed; plain TypeScript.

import { compositeTypeDefinitions } from '@/lib/sabcrm/shared/src/types/composite-types/composite-type-definitions';
import { type FieldMetadataType } from '@/lib/sabcrm/shared/src/types/FieldMetadataType';

import { isCompositePropertySupportedInGroupBy } from '@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/utils/is-composite-property-supported-in-group-by.util';

export const getGroupableSubFieldsForCompositeType = (
  type: FieldMetadataType,
): string[] | null => {
  const compositeTypeDefinition = compositeTypeDefinitions.get(type);

  if (!compositeTypeDefinition) {
    return null;
  }

  return compositeTypeDefinition.properties
    .filter(isCompositePropertySupportedInGroupBy)
    .map((property) => property.name);
};
