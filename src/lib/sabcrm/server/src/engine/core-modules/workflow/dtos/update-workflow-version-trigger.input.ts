import { z } from 'zod';

// PORT: graphql-input->zod
// Original: NestJS @InputType(); trigger typed as WorkflowTrigger (discriminated union)

export type UpdateWorkflowVersionTriggerInput = {
  /** Workflow version ID */
  workflowVersionId: string;
  /** Trigger to update in JSON format */
  trigger: Record<string, unknown>;
};

export const updateWorkflowVersionTriggerInputSchema = z.object({
  workflowVersionId: z.string().uuid({ message: 'workflowVersionId must be a valid UUID' }),
  trigger: z.record(z.unknown()),
});
