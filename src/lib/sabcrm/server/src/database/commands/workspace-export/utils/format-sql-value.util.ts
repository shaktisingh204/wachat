// PORT-NOTE: Ported from twenty-server database/commands/workspace-export/utils/format-sql-value.util.ts
// escapeLiteral is inlined here because the original references a Postgres-specific util.
// This implementation escapes single-quotes for SQL literal safety.

const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

/**
 * Minimal SQL literal escaper — wraps the value in single quotes and doubles
 * any interior single-quotes. Sufficient for export-only SQL generation.
 */
const escapeLiteral = (value: string): string => {
  return `'${value.replace(/'/g, "''")}'`;
};

export const formatSqlValue = (
  value: unknown,
  isJsonColumn = false,
): string => {
  if (!isDefined(value)) return 'NULL';

  if (isJsonColumn) {
    return escapeLiteral(JSON.stringify(value));
  }

  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'NULL';

    return String(value);
  }

  if (typeof value === 'bigint') return String(value);

  if (value instanceof Date) return escapeLiteral(value.toISOString());

  if (Array.isArray(value)) {
    if (value.length === 0) return "'{}'";

    if (isDefined(value[0]) && typeof value[0] === 'object') {
      return escapeLiteral(JSON.stringify(value));
    }

    const formattedElements = value.map((element) => {
      if (!isDefined(element)) return 'NULL';

      const stringElement = String(element);
      const escapedElement = stringElement
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');

      return `"${escapedElement}"`;
    });

    const arrayLiteral = `{${formattedElements.join(',')}}`;

    return `'${arrayLiteral.replace(/'/g, "''")}'`;
  }

  if (typeof value === 'object') {
    return escapeLiteral(JSON.stringify(value));
  }

  return escapeLiteral(String(value));
};
