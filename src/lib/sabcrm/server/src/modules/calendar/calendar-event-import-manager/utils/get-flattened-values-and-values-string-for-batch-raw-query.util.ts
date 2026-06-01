// server-logic: valuesStringForBatchRawQuery
// PORT-NOTE: This util originally generated Postgres $N parameter placeholders with
// optional type casts for batch raw SQL queries. MongoDB does not use parameterised
// SQL, so this helper has no runtime use in SabNode. It is preserved here for
// completeness (some code may import it) but its output is Postgres-specific.

/**
 * Generates a Postgres VALUES string with positional placeholders and optional
 * type casts, e.g. "($1::uuid, $2::text), ($3::uuid, $4::text)".
 *
 * PORT-NOTE: Postgres-only utility — not used in Mongo-backed SabNode code paths.
 * Preserved so the mapping stays complete.
 */
export const valuesStringForBatchRawQuery = (
  values: Record<string, unknown>[],
  typesArray: string[] = [],
): string => {
  const castedValues = values.reduce((acc: string[], _, rowIndex) => {
    const numberOfColumns = typesArray.length;

    const rowValues = Array.from(
      { length: numberOfColumns },
      (_, columnIndex) => {
        const placeholder = `$${rowIndex * numberOfColumns + columnIndex + 1}`;
        const typeCast = typesArray[columnIndex]
          ? `::${typesArray[columnIndex]}`
          : "";

        return `${placeholder}${typeCast}`;
      },
    ).join(", ");

    acc.push(`(${rowValues})`);
    return acc;
  }, []);

  return castedValues.join(", ");
};
