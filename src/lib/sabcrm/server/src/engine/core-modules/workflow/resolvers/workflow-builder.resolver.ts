import 'server-only';

// PORT: resolver->action
// Original: NestJS CoreResolver with @Mutation computeStepOutputSchema
// Ported as a plain async server function. Auth/permission guards must be enforced
// by the calling route handler (e.g. middleware or a session check).

import {
  WorkflowTriggerException,
  handleWorkflowTriggerException,
} from '@/lib/sabcrm/server/src/engine/core-modules/workflow/filters/workflow-trigger-graphql-api-exception.filter';

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

// Mirrors ComputeStepOutputSchemaInput from the original resolver
export type ComputeStepOutputSchemaInput = {
  /** The workflow step definition (JSON) */
  step: Record<string, unknown>;
  /** Workflow version ID */
  workflowVersionId: string;
};

// OutputSchema is an opaque JSON object in Twenty; preserve as-is
export type OutputSchema = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Service interface
// The actual Mongo-backed implementation lives in the workspace service layer;
// this resolver module calls it via a service function injected at call-site.
// ---------------------------------------------------------------------------

export type WorkflowSchemaWorkspaceService = {
  computeStepOutputSchema(params: {
    step: Record<string, unknown>;
    workspaceId: string;
    workflowVersionId: string;
  }): Promise<OutputSchema>;
};

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

/**
 * Compute the output schema for a workflow step.
 *
 * Mirrors the original `computeStepOutputSchema` GraphQL mutation.
 *
 * @param workspaceId  - Authenticated workspace ID (caller must validate session)
 * @param input        - Step definition + workflow version reference
 * @param service      - Injected workflow-schema service instance
 */
export async function computeStepOutputSchema(
  workspaceId: string,
  input: ComputeStepOutputSchemaInput,
  service: WorkflowSchemaWorkspaceService,
): Promise<OutputSchema> {
  try {
    return await service.computeStepOutputSchema({
      step: input.step,
      workspaceId,
      workflowVersionId: input.workflowVersionId,
    });
  } catch (err) {
    if (err instanceof WorkflowTriggerException) {
      handleWorkflowTriggerException(err);
    }
    throw err;
  }
}
