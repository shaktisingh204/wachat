import { ViewFilterOperand as RecordFilterOperand } from '@/lib/sabcrm/shared/src/types/ViewFilterOperand';

export const isEmptinessOperand = (operand: RecordFilterOperand): boolean => {
  return [
    RecordFilterOperand.IS_EMPTY,
    RecordFilterOperand.IS_NOT_EMPTY,
  ].includes(operand);
};
