/**
 * Type guard that returns true if the given value is an array with at least one element.
 */
export const isNonEmptyArray = <T>(
  probableArray: T[] | readonly T[] | undefined | null,
): probableArray is NonNullable<T[]> => {
  return (
    Array.isArray(probableArray) &&
    typeof probableArray.length === 'number' &&
    probableArray.length > 0
  );
};
