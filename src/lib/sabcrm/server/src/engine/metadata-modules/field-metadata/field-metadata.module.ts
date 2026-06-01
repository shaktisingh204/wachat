// PORT-NOTE: NestJS @Module has no Next.js equivalent.  This file acts as a
// registry/index re-exporting the ported pieces that the original module wired.

// Service
export {
  createOneField,
  createManyFields,
  updateOneField,
  deleteOneField,
  findFieldMetadataWithinWorkspace,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/services/field-metadata.service";

// Actions / resolver equivalents
export {
  createOneFieldAction,
  updateOneFieldAction,
  deleteOneFieldAction,
  getFieldRelationAction,
  getMorphFieldRelationsAction,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/field-metadata.resolver";

// Tools factory
export { generateFieldMetadataTools } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/tools/field-metadata-tools.factory";

// Exception
export {
  FieldMetadataException,
  FieldMetadataExceptionCode,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/field-metadata.exception";

// Entity / schema
export {
  getFieldMetadataCollection,
  ensureFieldMetadataIndexes,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/field-metadata.entity";

// Types
export type { FieldMetadataDocument } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/field-metadata.entity";
