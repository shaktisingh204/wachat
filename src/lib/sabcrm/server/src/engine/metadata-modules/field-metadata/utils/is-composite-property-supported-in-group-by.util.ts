// PORT-NOTE: Ported from twenty-server. NestJS removed; plain TypeScript.

import { type CompositeProperty } from '@/lib/sabcrm/shared/src/types/composite-types/composite-type.interface';
import { FieldMetadataType } from '@/lib/sabcrm/shared/src/types/FieldMetadataType';

export const isCompositePropertySupportedInGroupBy = (
  property: CompositeProperty,
): boolean => {
  return (
    property.hidden !== true && property.type !== FieldMetadataType.RAW_JSON
  );
};
