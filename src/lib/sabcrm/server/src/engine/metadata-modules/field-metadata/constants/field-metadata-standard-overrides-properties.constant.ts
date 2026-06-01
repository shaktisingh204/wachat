// PORT-NOTE: Ported from field-metadata-standard-overrides-properties.constant.ts.
// MetadataUniversalFlatEntityPropertiesToCompare is a complex generic type from Twenty's
// workspace-migration infrastructure; in SabNode it is simplified to a plain string union.

export const FIELD_METADATA_STANDARD_OVERRIDES_PROPERTIES = [
  'label',
  'description',
  'icon',
] as const;

export type FieldMetadataStandardOverridesProperty =
  (typeof FIELD_METADATA_STANDARD_OVERRIDES_PROPERTIES)[number];
