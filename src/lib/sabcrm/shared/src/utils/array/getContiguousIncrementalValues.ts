/**
 * Returns an array of contiguous incremental integer values.
 */
export const getContiguousIncrementalValues = (
  numberOfValues: number,
  startingValue = 0,
): number[] => {
  return Array.from(
    { length: numberOfValues },
    (_, index) => startingValue + index,
  );
};
