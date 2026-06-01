import { z } from "zod";

// PORT-NOTE: Original was a NestJS @InputType() GraphQL class.

export type DuplicateWorkflowVersionStepInput = {
  stepId: string;
  workflowVersionId: string;
};

export const duplicateWorkflowVersionStepInputSchema =
  z.object({
    stepId: z.string(),
    workflowVersionId: z.string(),
  }) satisfies z.ZodType<DuplicateWorkflowVersionStepInput>;
