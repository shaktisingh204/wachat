import { type ViewFilterOperand } from '@/lib/sabcrm/shared/src/types/ViewFilterOperand';
import { isRecordFilterValueValid } from '@/lib/sabcrm/shared/src/utils/filter/isRecordFilterValueValid';

export const filterOutInvalidRecordFilters = <
  T extends { operand: ViewFilterOperand; value: string },
>(
  recordFilters: T[],
): T[] => {
  return recordFilters.filter(isRecordFilterValueValid);
};
