// PORT-NOTE: NestJS GraphQL @ObjectType / registerEnumType removed; plain TS type.

import { type RelationType } from '@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/interfaces/relation-type.interface';

// FieldMetadataDTO and ObjectMetadataDTO are referenced by shape only — import
// the target paths produced by this port.  Using forward-reference type stubs
// here to avoid circular-import issues at the module level.
export type { RelationType };

export type RelationDTO = {
  type: RelationType;
  sourceObjectMetadata: {
    id: string;
    nameSingular: string;
    namePlural: string;
    [key: string]: unknown;
  };
  targetObjectMetadata: {
    id: string;
    nameSingular: string;
    namePlural: string;
    [key: string]: unknown;
  };
  sourceFieldMetadata: {
    id: string;
    name: string;
    [key: string]: unknown;
  };
  targetFieldMetadata: {
    id: string;
    name: string;
    [key: string]: unknown;
  };
};
