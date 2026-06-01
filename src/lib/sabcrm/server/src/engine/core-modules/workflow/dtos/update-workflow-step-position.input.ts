import { z } from 'zod';

// PORT: graphql-input->zod
// Original: NestJS @InputType() WorkflowStepPositionInput

export type WorkflowStepPositionInput = {
  x: number;
  y: number;
};

export const workflowStepPositionInputSchema = z.object({
  x: z.number(),
  y: z.number(),
});
