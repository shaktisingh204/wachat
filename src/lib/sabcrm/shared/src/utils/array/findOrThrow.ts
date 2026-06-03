/**
 * Finds an element in the array matching the predicate, or throws an error.
 */
export const findOrThrow = <T>(
  array: T[],
  predicate: (value: T) => boolean,
  error: Error = new Error('Element not found'),
): T => {
  const result = array.find(predicate);

  if (result === undefined) {
    throw error;
  }

  return result;
};
