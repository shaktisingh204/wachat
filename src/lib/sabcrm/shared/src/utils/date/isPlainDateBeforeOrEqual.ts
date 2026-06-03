import { Temporal } from 'temporal-polyfill';

/**
 * Returns true if PlainDate `plainDateA` is before or equal to `plainDateB`.
 */
export const isPlainDateBeforeOrEqual = (
  plainDateA: Temporal.PlainDate,
  plainDateB: Temporal.PlainDate,
): boolean => {
  const comparisonResult = Temporal.PlainDate.compare(plainDateA, plainDateB);

  return comparisonResult <= 0;
};
