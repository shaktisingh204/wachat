/**
 * Returns true if the value is neither null nor undefined.
 */
export const isDefined = <T>(
  value: T | null | undefined,
): value is NonNullable<T> => value !== undefined && value !== null;
