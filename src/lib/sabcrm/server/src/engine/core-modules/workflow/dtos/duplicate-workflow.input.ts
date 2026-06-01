import { z } from 'zod';

// PORT: graphql-input->zod
// Original: NestJS @InputType() with @Field decorators for GraphQL

export type DuplicateWorkflowInput = {
  /** Workflow ID to duplicate */
  workflowIdToDuplicate: string;
  /** Workflow version ID to copy */
  workflowVersionIdToCopy: string;
};

export const duplicateWorkflowInputSchema = z.object({
  workflowIdToDuplicate: z.string().uuid({ message: 'workflowIdToDuplicate must be a valid UUID' }),
  workflowVersionIdToCopy: z.string().uuid({ message: 'workflowVersionIdToCopy must be a valid UUID' }),
});
