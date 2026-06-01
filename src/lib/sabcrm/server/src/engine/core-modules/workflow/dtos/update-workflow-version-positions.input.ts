import { z } from 'zod';

import {
  WorkflowStepPositionUpdateInput,
  workflowStepPositionUpdateInputSchema,
} from '@/lib/sabcrm/server/src/engine/core-modules/workflow/dtos/update-workflow-step-position-update.input';

// PORT: graphql-input->zod
// Original: NestJS @InputType() UpdateWorkflowVersionPositionsInput

export type UpdateWorkflowVersionPositionsInput = {
  /** Workflow version ID */
  workflowVersionId: string;
  /** Updated positions for steps and triggers */
  positions: WorkflowStepPositionUpdateInput[];
};

export const updateWorkflowVersionPositionsInputSchema = z.object({
  workflowVersionId: z.string().uuid({ message: 'workflowVersionId must be a valid UUID' }),
  positions: z.array(workflowStepPositionUpdateInputSchema),
});
