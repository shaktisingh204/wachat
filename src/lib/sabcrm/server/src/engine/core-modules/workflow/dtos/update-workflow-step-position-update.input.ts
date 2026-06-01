import { z } from 'zod';

import {
  WorkflowStepPositionInput,
  workflowStepPositionInputSchema,
} from '@/lib/sabcrm/server/src/engine/core-modules/workflow/dtos/update-workflow-step-position.input';

// PORT: graphql-input->zod
// Original: NestJS @InputType() WorkflowStepPositionUpdateInput

export type WorkflowStepPositionUpdateInput = {
  /** Step or trigger ID */
  id: string;
  /** Position of the step or trigger */
  position: WorkflowStepPositionInput;
};

export const workflowStepPositionUpdateInputSchema = z.object({
  id: z.string().min(1, { message: 'id must not be empty' }),
  position: workflowStepPositionInputSchema,
});
