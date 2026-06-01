import { z } from 'zod';

// PORT: graphql-input->zod
// Original: NestJS @InputType() with @Field decorators; payload was graphql-type-json

export type RunWorkflowVersionInput = {
  /** Workflow version ID */
  workflowVersionId: string;
  /** Workflow run ID (optional) */
  workflowRunId?: string | null;
  /** Execution payload in JSON format (optional) */
  payload?: Record<string, unknown>;
};

export const runWorkflowVersionInputSchema = z.object({
  workflowVersionId: z.string().uuid({ message: 'workflowVersionId must be a valid UUID' }),
  workflowRunId: z.string().uuid().nullable().optional(),
  payload: z.record(z.unknown()).optional(),
});
