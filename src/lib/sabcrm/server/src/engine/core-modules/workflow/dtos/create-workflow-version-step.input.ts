import { z } from "zod";

// PORT-NOTE: Original was a NestJS @InputType() GraphQL class.
// WorkflowActionType, WorkflowStepConnectionOptions, WorkflowActionSettings,
// and WorkflowStepPositionInput are complex types from twenty-server modules.
// We accept them as string / plain objects here; the full type definitions
// will be provided by the respective ported modules.

export type WorkflowStepPosition = {
  x: number;
  y: number;
};

export type CreateWorkflowVersionStepInput = {
  /** Workflow version ID */
  workflowVersionId: string;
  /** New step type (WorkflowActionType) */
  stepType: string;
  /** Parent step ID — can be 'trigger' */
  parentStepId?: string;
  /** Parent step connection options (JSON, optional) */
  parentStepConnectionOptions?: Record<string, unknown>;
  /** Next step ID (optional) */
  nextStepId?: string;
  /** Canvas position (optional) */
  position?: WorkflowStepPosition;
  /** Step ID (optional — auto-generated if absent) */
  id?: string;
  /** Default settings for the step (JSON, optional) */
  defaultSettings?: Record<string, unknown>;
};

export const workflowStepPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const createWorkflowVersionStepInputSchema =
  z.object({
    workflowVersionId: z.string().uuid(),
    stepType: z.string(),
    parentStepId: z.string().optional(),
    parentStepConnectionOptions: z.record(z.unknown()).optional(),
    nextStepId: z.string().uuid().optional(),
    position: workflowStepPositionSchema.optional(),
    id: z.string().optional(),
    defaultSettings: z.record(z.unknown()).optional(),
  }) satisfies z.ZodType<CreateWorkflowVersionStepInput>;
