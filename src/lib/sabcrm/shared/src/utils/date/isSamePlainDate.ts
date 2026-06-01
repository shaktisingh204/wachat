import { Temporal } from 'temporal-polyfill';

/**
 * Returns true if two PlainDates represent the same calendar date.
 */
export const isSamePlainDate = (
  plainDateA: Temporal.PlainDate,
  plainDateB: Temporal.PlainDate,
): boolean => {
  return Temporal.PlainDate.compare(plainDateA, plainDateB) === 0;
};
