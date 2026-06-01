import { type ObjectMetadataForToolSchema } from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/types/object-metadata-for-tool-schema.type';
import { generateRecordPropertiesZodSchema } from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/zod-schemas/record-properties.zod-schema';
import { type RestrictedFieldsPermissions } from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/utils/generate-create-many-record-input-schema.util';

export const generateCreateRecordInputSchema = (
  objectMetadata: ObjectMetadataForToolSchema,
  restrictedFields?: RestrictedFieldsPermissions,
) => {
  return generateRecordPropertiesZodSchema(
    objectMetadata,
    false,
    restrictedFields,
  );
};
