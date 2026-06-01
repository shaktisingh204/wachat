// PORT-NOTE: Ported from twenty-server. FlatFieldMetadata and FlatObjectMetadata
// are local stub types until their modules are ported.

export type FlatFieldMetadata = {
  id: string;
  name: string;
  type: string;
  isNullable: boolean;
  description?: string;
  options?: Array<{ value: string; label?: string }>;
  settings?: Record<string, unknown>;
};

export type FlatObjectMetadata = {
  id: string;
  nameSingular: string;
  namePlural: string;
  isCustom: boolean;
  labelIdentifierFieldMetadataId?: string;
  imageIdentifierFieldMetadataId?: string;
  fieldIdByName?: Record<string, string>;
  [key: string]: unknown;
};

// Object metadata type enriched with flat fields for tool schema generation
export type ObjectMetadataForToolSchema = FlatObjectMetadata & {
  fields: FlatFieldMetadata[];
};
