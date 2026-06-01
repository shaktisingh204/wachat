/**
 * Returns a reducer function that sums a numeric property across items.
 * Skips non-numeric values. Suitable for use with Array.reduce.
 */
export const sumByProperty = <T, K extends keyof T>(property: K) => {
  return (accumulator: number, nextItem: T): number => {
    if (typeof accumulator !== 'number') {
      accumulator = 0;
    }

    const value = nextItem[property];
    if (typeof value !== 'number' || isNaN(value as unknown as number)) {
      return accumulator;
    }

    accumulator += value as unknown as number;

    return accumulator;
  };
};
