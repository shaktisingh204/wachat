import { z } from 'zod';
import { StepLogicalOperator } from '@/lib/sabcrm/shared/src/types/StepFilters';

// StepLogicalOperator enum values used as a zod enum tuple
const stepLogicalOperatorValues = Object.values(StepLogicalOperator) as [
  StepLogicalOperator,
  ...StepLogicalOperator[],
];

export const stepFilterGroupSchema = z.object({
  id: z.string(),
  logicalOperator: z.enum(stepLogicalOperatorValues),
  parentStepFilterGroupId: z.string().optional(),
  positionInStepFilterGroup: z.number().optional(),
});
