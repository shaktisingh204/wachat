import 'server-only';

// PORT: resolver->action
// Original: NestJS CoreResolver with mutations:
//   createWorkflowVersionEdge, deleteWorkflowVersionEdge
// Ported as plain async server functions. Auth/permission guards must be
// enforced by the calling route handler.

import {
  WorkflowVersionEdgeException,
  handleWorkflowVersionEdgeException,
} from '@/lib/sabcrm/server/src/engine/core-modules/workflow/filters/workflow-version-edge-graphql-api-exception.filter';
import { WorkflowVersionStepChangesDTO } from '@/lib/sabcrm/server/src/engine/core-modules/workflow/dtos/workflow-version-step-changes.dto';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

// Mirrors CreateWorkflowVersionEdgeInput from the original resolver.
// Full zod schema belongs in the dtos layer (ported in a separate batch).
export type CreateWorkflowVersionEdgeInput = {
  source: string;
  target: string;
  workflowVersionId: string;
  sourceConnectionOptions?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export type WorkflowVersionEdgeWorkspaceService = {
  createWorkflowVersionEdge(params: {
    source: string;
    target: string;
    workflowVersionId: string;
    workspaceId: string;
    sourceConnectionOptions?: Record<string, unknown>;
  }): Promise<WorkflowVersionStepChangesDTO>;
  deleteWorkflowVersionEdge(params: {
    source: string;
    target: string;
    workflowVersionId: string;
    workspaceId: string;
    sourceConnectionOptions?: Record<string, unknown>;
  }): Promise<WorkflowVersionStepChangesDTO>;
};

// ---------------------------------------------------------------------------
// Mutations (server actions)
// ---------------------------------------------------------------------------

/** Create an edge between two steps in a workflow version. */
export async function createWorkflowVersionEdge(
  workspaceId: string,
  input: CreateWorkflowVersionEdgeInput,
  service: WorkflowVersionEdgeWorkspaceService,
): Promise<WorkflowVersionStepChangesDTO> {
  try {
    return await service.createWorkflowVersionEdge({
      source: input.source,
      target: input.target,
      workflowVersionId: input.workflowVersionId,
      workspaceId,
      sourceConnectionOptions: input.sourceConnectionOptions,
    });
  } catch (err) {
    if (err instanceof WorkflowVersionEdgeException) handleWorkflowVersionEdgeException(err);
    throw err;
  }
}

/** Delete an edge between two steps in a workflow version. */
export async function deleteWorkflowVersionEdge(
  workspaceId: string,
  input: CreateWorkflowVersionEdgeInput,
  service: WorkflowVersionEdgeWorkspaceService,
): Promise<WorkflowVersionStepChangesDTO> {
  try {
    return await service.deleteWorkflowVersionEdge({
      source: input.source,
      target: input.target,
      workflowVersionId: input.workflowVersionId,
      workspaceId,
      sourceConnectionOptions: input.sourceConnectionOptions,
    });
  } catch (err) {
    if (err instanceof WorkflowVersionEdgeException) handleWorkflowVersionEdgeException(err);
    throw err;
  }
}
