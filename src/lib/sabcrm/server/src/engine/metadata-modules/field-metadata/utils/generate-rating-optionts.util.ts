// PORT-NOTE: Ported from twenty-server. NestJS removed; plain TypeScript.
// FieldMetadataDefaultOption is imported from the shared ported types.

import { v4 as uuidV4 } from 'uuid';

import { type FieldMetadataDefaultOption } from '@/lib/sabcrm/shared/src/types/FieldMetadataOptions';

const range = {
  start: 1,
  end: 5,
};

export function generateRatingOptions(): FieldMetadataDefaultOption[] {
  const options: FieldMetadataDefaultOption[] = [];

  for (let i = range.start; i <= range.end; i++) {
    options.push({
      id: uuidV4(),
      label: i.toString(),
      value: `RATING_${i}`,
      position: i - 1,
    });
  }

  return options;
}
