import 'server-only';

// PORT: resolver->action
// Original: NestJS CoreResolver with one @Query and many @Mutation handlers:
//   workflowStepConnectedAccountHandle (query)
//   createWorkflowVersionStep
//   updateWorkflowVersionStep
//   deleteWorkflowVersionStep
//   submitFormStep
//   updateWorkflowRunStep
//   duplicateWorkflowVersionStep
//   testHttpRequest
// Ported as plain async server functions. Auth/permission guards must be
// enforced by the calling route handler.

import {
  WorkflowVersionStepException,
  handleWorkflowVersionStepException,
} from '@/lib/sabcrm/server/src/engine/core-modules/workflow/filters/workflow-version-step-graphql-api-exception.filter';
import { WorkflowActionDTO } from '@/lib/sabcrm/server/src/engine/core-modules/workflow/dtos/workflow-action.dto';
import { WorkflowVersionStepChangesDTO } from '@/lib/sabcrm/server/src/engine/core-modules/workflow/dtos/workflow-version-step-changes.dto';
import { SubmitFormStepInput } from '@/lib/sabcrm/server/src/engine/core-modules/workflow/dtos/submit-form-step.input';
import { UpdateWorkflowRunStepInput } from '@/lib/sabcrm/server/src/engine/core-modules/workflow/dtos/update-workflow-run-step.input';
import { TestHttpRequestInput } from '@/lib/sabcrm/server/src/engine/core-modules/workflow/dtos/test-http-request.input';
import { TestHttpRequestDTO } from '@/lib/sabcrm/server/src/engine/core-modules/workflow/dtos/test-http-request.dto';

// ---------------------------------------------------------------------------
// Input types referenced by original mutations (ported in this batch or prior)
// ---------------------------------------------------------------------------

export type CreateWorkflowVersionStepInput = {
  workflowVersionId: string;
  type: string;
  /** Position where the step is inserted */
  position?: { x: number; y: number };
};

export type DeleteWorkflowVersionStepInput = {
  workflowVersionId: string;
  stepId: string;
};

export type DuplicateWorkflowVersionStepInput = {
  workflowVersionId: string;
  stepId: string;
};

export type UpdateWorkflowVersionStepInput = {
  workflowVersionId: string;
  step: Record<string, unknown>;
};

// ConnectedAccountHandle mirrors ConnectedAccountHandleDTO from the original query
export type ConnectedAccountHandleDTO = {
  id: string;
  handle: string;
  provider: string;
};

// ---------------------------------------------------------------------------
// Service interfaces (Mongo-backed implementations provided by caller)
// ---------------------------------------------------------------------------

export type WorkflowVersionStepWorkspaceService = {
  createWorkflowVersionStep(params: {
    workspaceId: string;
    input: CreateWorkflowVersionStepInput;
  }): Promise<WorkflowVersionStepChangesDTO>;
  updateWorkflowVersionStep(params: {
    workspaceId: string;
    workflowVersionId: string;
    step: Record<string, unknown>;
  }): Promise<WorkflowActionDTO>;
  deleteWorkflowVersionStep(params: {
    workspaceId: string;
    workflowVersionId: string;
    stepIdToDelete: string;
  }): Promise<WorkflowVersionStepChangesDTO>;
  duplicateWorkflowVersionStep(params: {
    workspaceId: string;
    workflowVersionId: string;
    stepId: string;
  }): Promise<WorkflowVersionStepChangesDTO>;
};

export type WorkflowRunnerWorkspaceService = {
  submitFormStep(params: {
    workspaceId: string;
    stepId: string;
    workflowRunId: string;
    response: Record<string, unknown>;
  }): Promise<void>;
};

export type WorkflowRunWorkspaceService = {
  updateWorkflowRunStep(params: {
    workspaceId: string;
    workflowRunId: string;
    step: Record<string, unknown>;
  }): Promise<void>;
};

export type ConnectedAccountMetadataService = {
  findById(params: { id: string; workspaceId: string }): Promise<ConnectedAccountHandleDTO | null>;
};

export type HttpToolService = {
  execute(
    params: { url: string; method: string; headers?: Record<string, string>; body?: unknown },
    context: { workspaceId: string },
  ): Promise<TestHttpRequestDTO>;
};

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * Retrieve the connected account handle for a workflow step.
 * Mirrors the original `workflowStepConnectedAccountHandle` query.
 */
export async function workflowStepConnectedAccountHandle(
  workspaceId: string,
  connectedAccountId: string,
  service: ConnectedAccountMetadataService,
): Promise<ConnectedAccountHandleDTO | null> {
  return service.findById({ id: connectedAccountId, workspaceId });
}

// ---------------------------------------------------------------------------
// Mutations (server actions)
// ---------------------------------------------------------------------------

/** Create a new step inside a workflow version. */
export async function createWorkflowVersionStep(
  workspaceId: string,
  input: CreateWorkflowVersionStepInput,
  service: WorkflowVersionStepWorkspaceService,
): Promise<WorkflowVersionStepChangesDTO> {
  try {
    return await service.createWorkflowVersionStep({ workspaceId, input });
  } catch (err) {
    if (err instanceof WorkflowVersionStepException) handleWorkflowVersionStepException(err);
    throw err;
  }
}

/** Update an existing step in a workflow version. */
export async function updateWorkflowVersionStep(
  workspaceId: string,
  input: UpdateWorkflowVersionStepInput,
  service: WorkflowVersionStepWorkspaceService,
): Promise<WorkflowActionDTO> {
  try {
    return await service.updateWorkflowVersionStep({
      workspaceId,
      workflowVersionId: input.workflowVersionId,
      step: input.step,
    });
  } catch (err) {
    if (err instanceof WorkflowVersionStepException) handleWorkflowVersionStepException(err);
    throw err;
  }
}

/** Delete a step from a workflow version. */
export async function deleteWorkflowVersionStep(
  workspaceId: string,
  input: DeleteWorkflowVersionStepInput,
  service: WorkflowVersionStepWorkspaceService,
): Promise<WorkflowVersionStepChangesDTO> {
  try {
    return await service.deleteWorkflowVersionStep({
      workspaceId,
      workflowVersionId: input.workflowVersionId,
      stepIdToDelete: input.stepId,
    });
  } catch (err) {
    if (err instanceof WorkflowVersionStepException) handleWorkflowVersionStepException(err);
    throw err;
  }
}

/** Submit a form step response for a running workflow. */
export async function submitFormStep(
  workspaceId: string,
  input: SubmitFormStepInput,
  service: WorkflowRunnerWorkspaceService,
): Promise<boolean> {
  try {
    await service.submitFormStep({
      workspaceId,
      stepId: input.stepId,
      workflowRunId: input.workflowRunId,
      response: input.response as Record<string, unknown>,
    });
    return true;
  } catch (err) {
    if (err instanceof WorkflowVersionStepException) handleWorkflowVersionStepException(err);
    throw err;
  }
}

/** Update a step definition within an active workflow run. */
export async function updateWorkflowRunStep(
  workspaceId: string,
  input: UpdateWorkflowRunStepInput,
  service: WorkflowRunWorkspaceService,
): Promise<WorkflowActionDTO> {
  try {
    await service.updateWorkflowRunStep({
      workspaceId,
      workflowRunId: input.workflowRunId,
      step: input.step,
    });
    // Mirror original behaviour: return the step passed in
    return input.step as unknown as WorkflowActionDTO;
  } catch (err) {
    if (err instanceof WorkflowVersionStepException) handleWorkflowVersionStepException(err);
    throw err;
  }
}

/** Duplicate an existing step within a workflow version. */
export async function duplicateWorkflowVersionStep(
  workspaceId: string,
  input: DuplicateWorkflowVersionStepInput,
  service: WorkflowVersionStepWorkspaceService,
): Promise<WorkflowVersionStepChangesDTO> {
  try {
    return await service.duplicateWorkflowVersionStep({
      workspaceId,
      workflowVersionId: input.workflowVersionId,
      stepId: input.stepId,
    });
  } catch (err) {
    if (err instanceof WorkflowVersionStepException) handleWorkflowVersionStepException(err);
    throw err;
  }
}

/** Execute a test HTTP request (used during step configuration). */
export async function testHttpRequest(
  workspaceId: string,
  input: TestHttpRequestInput,
  httpTool: HttpToolService,
): Promise<TestHttpRequestDTO> {
  try {
    return await httpTool.execute(
      {
        url: input.url,
        method: input.method,
        headers: input.headers,
        body: input.body,
      },
      { workspaceId },
    );
  } catch (err) {
    if (err instanceof WorkflowVersionStepException) handleWorkflowVersionStepException(err);
    throw err;
  }
}
