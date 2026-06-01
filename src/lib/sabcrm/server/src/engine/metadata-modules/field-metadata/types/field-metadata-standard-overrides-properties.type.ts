// PORT-NOTE: The original imports from a constants file that is not in this
// batch. The constant is defined inline here as a stable tuple of known
// property names. If the upstream constant changes, update both files.

export const FIELD_METADATA_STANDARD_OVERRIDES_PROPERTIES = [
  "label",
  "description",
  "icon",
] as const;

export type FieldMetadataStandardOverridesProperties =
  (typeof FIELD_METADATA_STANDARD_OVERRIDES_PROPERTIES)[number];
