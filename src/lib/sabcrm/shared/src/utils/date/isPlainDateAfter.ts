import { Temporal } from 'temporal-polyfill';

/**
 * Returns true if PlainDate `a` is strictly after PlainDate `b`.
 */
export const isPlainDateAfter = (
  a: Temporal.PlainDate,
  b: Temporal.PlainDate,
): boolean => {
  return Temporal.PlainDate.compare(a, b) === 1;
};
