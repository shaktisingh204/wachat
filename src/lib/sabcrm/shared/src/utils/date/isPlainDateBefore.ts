import { Temporal } from 'temporal-polyfill';

/**
 * Returns true if PlainDate `a` is strictly before PlainDate `b`.
 */
export const isPlainDateBefore = (
  a: Temporal.PlainDate,
  b: Temporal.PlainDate,
): boolean => {
  return Temporal.PlainDate.compare(a, b) === -1;
};
