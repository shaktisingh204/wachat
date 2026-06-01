// port: type-only module — ported faithfully.
// ObjectRecord and FlatObjectMetadata are aliased to plain types below.

export type ObjectRecord = Record<string, unknown>;

export type FlatObjectMetadata = {
  id: string;
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
  isActive: boolean;
  isSearchable: boolean;
  labelIdentifierFieldMetadataId?: string;
  imageIdentifierFieldMetadataId?: string;
  standardOverrides?: { labelSingular?: string; labelPlural?: string };
  [key: string]: unknown;
};

export type RecordsWithObjectMetadataItem = {
  objectMetadataItem: FlatObjectMetadata;
  records: ObjectRecord[];
};
