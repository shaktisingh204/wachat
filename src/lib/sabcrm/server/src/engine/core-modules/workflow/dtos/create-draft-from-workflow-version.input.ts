import { z } from "zod";

// PORT-NOTE: Original was a NestJS @InputType() GraphQL class.
// Ported to a plain TypeScript type + Zod schema.

export type CreateDraftFromWorkflowVersionInput = {
  /** Workflow ID */
  workflowId: string;
  /** Workflow version ID to copy */
  workflowVersionIdToCopy: string;
};

export const createDraftFromWorkflowVersionInputSchema =
  z.object({
    workflowId: z.string().uuid(),
    workflowVersionIdToCopy: z.string().uuid(),
  }) satisfies z.ZodType<CreateDraftFromWorkflowVersionInput>;
