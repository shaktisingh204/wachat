import { z } from 'zod';

// PORT: graphql-input->zod
// Original: NestJS @InputType() with @Field decorators; response was graphql-type-json

export type SubmitFormStepInput = {
  /** Workflow step ID */
  stepId: string;
  /** Workflow run ID */
  workflowRunId: string;
  /** Form response in JSON format */
  response: Record<string, unknown>;
};

export const submitFormStepInputSchema = z.object({
  stepId: z.string().uuid({ message: 'stepId must be a valid UUID' }),
  workflowRunId: z.string().uuid({ message: 'workflowRunId must be a valid UUID' }),
  response: z.record(z.unknown()),
});
