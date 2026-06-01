import { z } from 'zod';

import { type ObjectMetadataForToolSchema } from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/types/object-metadata-for-tool-schema.type';
import { type RestrictedFieldsPermissions } from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/utils/generate-create-many-record-input-schema.util';
import { generateRecordPropertiesZodSchema } from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/zod-schemas/record-properties.zod-schema';

export const generateUpdateRecordInputSchema = (
  objectMetadata: ObjectMetadataForToolSchema,
  restrictedFields?: RestrictedFieldsPermissions,
) => {
  const recordPropertiesSchema = generateRecordPropertiesZodSchema(
    objectMetadata,
    false,
    restrictedFields,
  );

  return recordPropertiesSchema.partial().extend({
    id: z.string().uuid({
      message:
        'The unique identifier (UUID) of the record to update. This is required to identify which record should be modified.',
    }),
  });
};
