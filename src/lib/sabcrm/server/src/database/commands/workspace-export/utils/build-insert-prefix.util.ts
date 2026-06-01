// PORT-NOTE: Utility function ported directly from twenty-server.
// Original uses an `escapeIdentifier` helper from the Postgres migration utils.
// In SabNode this util is used for workspace export SQL generation;
// the escapeIdentifier implementation is inlined below.

/**
 * Escapes a Postgres identifier (schema/table/column name) by wrapping it
 * in double quotes and escaping any embedded double-quote characters.
 */
function escapeIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Builds the INSERT INTO prefix for a bulk SQL insert statement.
 *
 * @example
 * buildInsertPrefix("public", "myTable", ["id", "name"])
 * // → `INSERT INTO "public"."myTable" ("id", "name") VALUES `
 */
export const buildInsertPrefix = (
  schemaName: string,
  tableName: string,
  columnNames: string[],
): string => {
  const escapedColumnNames = columnNames.map(escapeIdentifier).join(", ");

  return `INSERT INTO ${escapeIdentifier(schemaName)}.${escapeIdentifier(tableName)} (${escapedColumnNames}) VALUES `;
};
