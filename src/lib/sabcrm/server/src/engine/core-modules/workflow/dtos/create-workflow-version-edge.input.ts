import { z } from "zod";

// PORT-NOTE: Original was a NestJS @InputType() GraphQL class.
// WorkflowStepConnectionOptions is a JSON object — accepted as unknown here.

export type WorkflowStepConnectionOptions = Record<string, unknown>;

export type CreateWorkflowVersionEdgeInput = {
  /** Workflow version ID */
  workflowVersionId: string;
  /** Source step ID */
  source: string;
  /** Target step ID */
  target: string;
  /** Source step connection options (JSON, optional) */
  sourceConnectionOptions?: WorkflowStepConnectionOptions;
};

export const createWorkflowVersionEdgeInputSchema =
  z.object({
    workflowVersionId: z.string(),
    source: z.string(),
    target: z.string(),
    sourceConnectionOptions: z.record(z.unknown()).optional(),
  }) satisfies z.ZodType<CreateWorkflowVersionEdgeInput>;
