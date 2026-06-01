import { z } from 'zod';

// PORT: graphql-input->zod
// Original: NestJS @InputType(); step typed as WorkflowAction (discriminated union)

// We use z.record(z.unknown()) for WorkflowAction since it's a large discriminated
// union whose full zod schema lives in the shared layer; runtime validation at the
// individual action level is deferred to the service layer.
export type WorkflowActionLike = Record<string, unknown> & { id: string; type: string };

export type UpdateWorkflowRunStepInput = {
  /** Workflow run ID */
  workflowRunId: string;
  /** Step to update */
  step: WorkflowActionLike;
};

export const updateWorkflowRunStepInputSchema = z.object({
  workflowRunId: z.string().uuid({ message: 'workflowRunId must be a valid UUID' }),
  step: z.record(z.unknown()),
});
