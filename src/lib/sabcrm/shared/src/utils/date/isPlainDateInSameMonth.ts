import { type Temporal } from 'temporal-polyfill';

/**
 * Returns true if both PlainDates fall within the same calendar month and year.
 */
export const isPlainDateInSameMonth = (
  plainDateA: Temporal.PlainDate,
  plainDateB: Temporal.PlainDate,
): boolean => {
  return (
    plainDateA.month === plainDateB.month && plainDateA.year === plainDateB.year
  );
};
