import { z } from "zod";

// PORT-NOTE: Original was a NestJS @InputType() GraphQL class.

export type DeleteWorkflowVersionStepInput = {
  /** Workflow version ID */
  workflowVersionId: string;
  /** ID of the step to delete */
  stepId: string;
};

export const deleteWorkflowVersionStepInputSchema =
  z.object({
    workflowVersionId: z.string().uuid(),
    stepId: z.string(),
  }) satisfies z.ZodType<DeleteWorkflowVersionStepInput>;
