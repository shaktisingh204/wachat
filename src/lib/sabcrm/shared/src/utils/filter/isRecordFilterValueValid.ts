import { type ViewFilterOperand } from '@/lib/sabcrm/shared/src/types/ViewFilterOperand';
import { isDefined } from '@/lib/sabcrm/shared/src/utils/validation/isDefined';

import { isRecordFilterOperandExpectingValue } from './isRecordFilterOperandExpectingValue';

export const isRecordFilterValueValid = (recordFilter: {
  operand: ViewFilterOperand;
  value: string;
}): boolean => {
  if (!isRecordFilterOperandExpectingValue(recordFilter.operand)) {
    return true;
  }

  return (
    isDefined(recordFilter.value) &&
    recordFilter.value !== '' &&
    recordFilter.value !== '[]'
  );
};
