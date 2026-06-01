import { type Temporal } from 'temporal-polyfill';

/**
 * Returns true if the given PlainDate falls on a weekend (Saturday or Sunday).
 * Uses the ISO 8601 dayOfWeek convention: 1 = Monday … 7 = Sunday.
 */
export const isPlainDateInWeekend = (plainDate: Temporal.PlainDate): boolean => {
  return plainDate.dayOfWeek > 5;
};
