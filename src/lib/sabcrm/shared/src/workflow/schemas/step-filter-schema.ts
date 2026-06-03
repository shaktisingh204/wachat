import { z } from 'zod';
import { ViewFilterOperand } from '@/lib/sabcrm/shared/src/types/ViewFilterOperand';
import { ViewFilterOperandDeprecated } from '@/lib/sabcrm/shared/src/types/ViewFilterOperandDeprecated';

const viewFilterOperandValues = Object.values(ViewFilterOperand) as [
  ViewFilterOperand,
  ...ViewFilterOperand[],
];

const viewFilterOperandDeprecatedValues = Object.values(
  ViewFilterOperandDeprecated,
) as [ViewFilterOperandDeprecated, ...ViewFilterOperandDeprecated[]];

export const stepFilterSchema = z.object({
  id: z.string(),
  type: z.string(),
  stepOutputKey: z.string(),
  operand: z
    .enum(viewFilterOperandValues)
    .or(z.enum(viewFilterOperandDeprecatedValues)),
  value: z.string(),
  stepFilterGroupId: z.string(),
  positionInStepFilterGroup: z.number().optional(),
  fieldMetadataId: z.string().optional(),
  compositeFieldSubFieldName: z.string().optional(),
});
