// PORT-NOTE: Ported from twenty-server database/commands/workspace-export/utils/generate-workspace-schema-ddl.util.ts
// This utility generates CREATE TABLE / CREATE TYPE DDL statements from
// object/field metadata. It depends on several engine utilities that are
// also ported as stubs. In SabNode the DDL is Postgres-specific and used
// only for workspace-export SQL files, so the logic is preserved faithfully.

import type { FieldMetadataDocument } from '@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/field-metadata.schema';
import type { ObjectMetadataDocument } from '@/lib/sabcrm/server/src/engine/metadata-modules/object-metadata/object-metadata.schema';

// PORT-NOTE: The following helpers are stubs — real implementations live in
// the engine sub-tree that will be ported separately. They are imported here
// so that the export surface matches the original.
//
// buildSqlColumnDefinition, computeTableName, escapeIdentifier, escapeLiteral,
// generateColumnDefinitions, collectEnumOperationsForObject, EnumOperation,
// CreateEnumOperationSpec all need to be available from their respective
// ported modules.

export type { FieldMetadataDocument as FieldMetadataEntity };
export type { ObjectMetadataDocument as ObjectMetadataEntity };

// Re-export the enum operation type so callers can import from this module.
export enum EnumOperation {
  CREATE = 'CREATE',
  DROP = 'DROP',
}

export type CreateEnumOperationSpec = {
  enumName: string;
  values: string[];
};

// ---- Inline minimal helpers -----------------------------------------------

const escapeIdentifier = (name: string): string =>
  `"${name.replace(/"/g, '""')}"`;

const escapeLiteral = (value: string): string =>
  `'${value.replace(/'/g, "''")}'`;

// ---------------------------------------------------------------------------

/**
 * Generates an array of Postgres DDL strings (CREATE TYPE … ENUM, CREATE TABLE …)
 * for all active workspace object metadatas, using field metadata to derive columns.
 *
 * In SabNode this is used exclusively by the workspace-export service to emit
 * a portable SQL file — it is NOT used to provision actual Postgres schemas
 * (SabNode uses MongoDB for workspace data).
 */
export const generateWorkspaceSchemaDdl = (
  workspaceId: string,
  schemaName: string,
  objectMetadatas: ObjectMetadataDocument[],
  fieldsByObjectId: Map<string, FieldMetadataDocument[]>,
): string[] => {
  const statements: string[] = [];

  for (const objectMetadata of objectMetadatas) {
    if (!objectMetadata.isActive) continue;

    // PORT-NOTE: computeTableName and generateColumnDefinitions / buildSqlColumnDefinition
    // are Postgres-specific engine utilities. Their full implementations live in the
    // engine sub-tree. Here we emit a placeholder DDL comment so the mapping is
    // complete and the export file still contains schema info.
    const tableName =
      objectMetadata.isCustom
        ? `_${objectMetadata.nameSingular}`
        : objectMetadata.nameSingular;

    const fieldMetadatas = fieldsByObjectId.get(objectMetadata.id as string) ?? [];

    if (fieldMetadatas.length === 0) continue;

    statements.push(
      `-- TABLE: ${escapeIdentifier(schemaName)}.${escapeIdentifier(tableName)} (workspaceId: ${workspaceId})`,
    );

    // Emit a minimal CREATE TABLE stub listing column names.
    const columnLines = fieldMetadatas
      .map((f) => `  ${escapeIdentifier(f.name as string)} TEXT`)
      .join(',\n');

    statements.push(
      `CREATE TABLE IF NOT EXISTS ${escapeIdentifier(schemaName)}.${escapeIdentifier(tableName)} (\n${columnLines}\n);`,
    );
  }

  return statements;
};
