import { z } from 'zod';

// PORT: graphql-input->zod
// Original: NestJS @InputType(); step typed as WorkflowAction (discriminated union)

export type UpdateWorkflowVersionStepInput = {
  /** Workflow version ID */
  workflowVersionId: string;
  /** Step to update in JSON format */
  step: Record<string, unknown>;
};

export const updateWorkflowVersionStepInputSchema = z.object({
  workflowVersionId: z.string().uuid({ message: 'workflowVersionId must be a valid UUID' }),
  step: z.record(z.unknown()),
});
