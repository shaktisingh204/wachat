import { z } from "zod";

// PORT-NOTE: Original was a NestJS @InputType() GraphQL class.
// Ported to a plain TypeScript type + Zod schema.
// WorkflowTrigger and WorkflowAction are complex union types — we accept any
// JSON object here and let downstream services validate the structure.

export type ComputeStepOutputSchemaInput = {
  /** Step in JSON format — either a WorkflowTrigger or WorkflowAction */
  step: Record<string, unknown>;
  /** Workflow version ID (optional) */
  workflowVersionId?: string;
};

export const computeStepOutputSchemaInputSchema =
  z.object({
    step: z.record(z.unknown()),
    workflowVersionId: z.string().uuid().optional(),
  }) satisfies z.ZodType<ComputeStepOutputSchemaInput>;
