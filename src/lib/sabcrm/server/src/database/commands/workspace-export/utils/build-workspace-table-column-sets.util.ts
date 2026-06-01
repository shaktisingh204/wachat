// PORT-NOTE: Utility function ported from twenty-server.
// Original uses TypeORM entity types (FieldMetadataEntity, ObjectMetadataEntity) and a
// generateColumnDefinitions utility that inspects the Postgres schema.
// In SabNode/MongoDB this utility is used during workspace export to determine which
// fields are JSON-typed and which are generated (tsvector). These concepts do not have
// a direct MongoDB analogue, but the utility is preserved for export pipeline compatibility.
// The FlatFieldMetadata / FlatObjectMetadata casts from the original are maintained.

export type ColumnType = "json" | "jsonb" | "tsvector" | "uuid" | "text" | "boolean" | "timestamptz" | string;

export type ColumnDefinition = {
  name: string;
  type: ColumnType;
  [key: string]: unknown;
};

export type FlatObjectMetadata = {
  id: string;
  nameSingular: string;
  [key: string]: unknown;
};

export type FlatFieldMetadata = {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
};

// Minimal ObjectMetadataEntity / FieldMetadataEntity shapes used by the export pipeline
export type ObjectMetadataEntity = {
  id: string;
  nameSingular: string;
  [key: string]: unknown;
};

export type FieldMetadataEntity = {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
};

export type WorkspaceTableColumnSets = {
  jsonColumns: Set<string>;
  generatedColumns: Set<string>;
};

// PORT-NOTE: generateColumnDefinitions from the original resolves TypeORM column
// definitions from field metadata. In SabNode there is no TypeORM, so we provide a
// minimal heuristic that covers the common cases used by the export pipeline.
// Replace with a proper implementation backed by the sabcrm_fieldMetadata collection
// if full parity is required.
const JSON_COLUMN_TYPES = new Set<string>(["json", "jsonb"]);

function generateColumnDefinitionsFromFieldMetadata(
  fieldMetadata: FieldMetadataEntity,
): ColumnDefinition[] {
  // Heuristic mapping from Twenty field type to Postgres column type.
  // Extend as needed when new field types are introduced.
  const fieldTypeToColumnType: Record<string, ColumnType> = {
    RICH_TEXT: "jsonb",
    MULTI_SELECT: "jsonb",
    RELATION: "uuid",
    FULL_NAME: "jsonb",
    CURRENCY: "jsonb",
    ADDRESS: "jsonb",
    LINKS: "jsonb",
    EMAILS: "jsonb",
    PHONES: "jsonb",
    ACTOR: "jsonb",
    ARRAY: "jsonb",
    UUID: "uuid",
    TEXT: "text",
    SELECT: "text",
    BOOLEAN: "boolean",
    DATE_TIME: "timestamptz",
    DATE: "timestamptz",
    NUMBER: "numeric",
    NUMERIC: "numeric",
    RATING: "text",
    POSITION: "float",
    RAW_JSON: "jsonb",
    TSQUERY: "tsquery",
    TS_VECTOR: "tsvector",
  };

  const columnType =
    fieldTypeToColumnType[fieldMetadata.type.toUpperCase()] ?? "text";

  return [{ name: fieldMetadata.name, type: columnType }];
}

/**
 * Builds two sets of column names for a given workspace object:
 *   - jsonColumns: columns whose values are JSON/JSONB (must be JSON-stringified on export)
 *   - generatedColumns: columns that are database-generated (tsvector) — skipped on insert
 *
 * PORT-NOTE: In SabNode/MongoDB there are no Postgres-generated columns or JSONB columns
 * at the DB layer. This utility is retained for the workspace SQL export pipeline which
 * generates Postgres-compatible INSERT statements. Pass real FieldMetadataEntity objects
 * (from the sabcrm_fieldMetadata collection) to get accurate sets.
 */
export const buildWorkspaceTableColumnSets = (
  workspaceId: string,
  objectMetadata: ObjectMetadataEntity,
  fieldMetadatas: FieldMetadataEntity[],
): WorkspaceTableColumnSets => {
  void workspaceId; // not used in the heuristic; kept for API compatibility

  const jsonColumns = new Set<string>();
  const generatedColumns = new Set<string>();

  const flatObjectMetadata = objectMetadata as unknown as FlatObjectMetadata;
  void flatObjectMetadata; // cast preserved for API parity

  for (const fieldMetadata of fieldMetadatas) {
    const columnDefinitions =
      generateColumnDefinitionsFromFieldMetadata(fieldMetadata);

    for (const columnDefinition of columnDefinitions) {
      if (JSON_COLUMN_TYPES.has(columnDefinition.type)) {
        jsonColumns.add(columnDefinition.name);
      }

      if (columnDefinition.type === "tsvector") {
        generatedColumns.add(columnDefinition.name);
      }
    }
  }

  return { jsonColumns, generatedColumns };
};
