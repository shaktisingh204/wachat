import { z } from 'zod';

import { type ObjectMetadataForToolSchema } from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/types/object-metadata-for-tool-schema.type';
import { generateRecordPropertiesZodSchema } from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/zod-schemas/record-properties.zod-schema';

// PORT-NOTE: RestrictedFieldsPermissions from twenty-shared/types ported inline.
export type RestrictedFieldsPermissions = Record<
  string,
  { canRead?: boolean; canUpdate?: boolean }
>;

export const generateCreateManyRecordInputSchema = (
  objectMetadata: ObjectMetadataForToolSchema,
  restrictedFields?: RestrictedFieldsPermissions,
) => {
  const recordSchema = generateRecordPropertiesZodSchema(
    objectMetadata,
    false,
    restrictedFields,
  );

  return z.object({
    records: z
      .array(recordSchema)
      .min(1)
      .max(20)
      .describe(
        'Array of records to create. Each record should contain the required fields. Maximum 20 records per call.',
      ),
  });
};
