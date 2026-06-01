import { type ArraySortDirection } from '@/lib/sabcrm/shared/src/types/ArraySortDirection';
import { Temporal } from 'temporal-polyfill';

/**
 * Returns a comparator for sorting Temporal.PlainDate values in ascending or descending order.
 * Suitable for use with Array.prototype.sort.
 */
export const sortPlainDate =
  (direction: ArraySortDirection) =>
  (plainDateA: Temporal.PlainDate, plainDateB: Temporal.PlainDate): number => {
    const comparisonResult = Temporal.PlainDate.compare(plainDateA, plainDateB);

    if (comparisonResult === 0) {
      return 0;
    }

    return direction === 'asc' ? comparisonResult : -comparisonResult;
  };
