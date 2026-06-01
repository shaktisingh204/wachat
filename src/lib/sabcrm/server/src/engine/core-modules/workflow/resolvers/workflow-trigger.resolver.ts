import 'server-only';

// PORT: resolver->action
// Original: NestJS CoreResolver with mutations:
//   activateWorkflowVersion, deactivateWorkflowVersion, runWorkflowVersion, stopWorkflowRun
// Ported as plain async server functions. Auth/permission guards (WorkspaceAuthGuard,
// UserAuthGuard, SettingsPermissionGuard(WORKFLOWS)) must be enforced by the calling
// route handler.

import {
  WorkflowTriggerException,
  handleWorkflowTriggerException,
} from '@/lib/sabcrm/server/src/engine/core-modules/workflow/filters/workflow-trigger-graphql-api-exception.filter';
import { RunWorkflowVersionInput } from '@/lib/sabcrm/server/src/engine/core-modules/workflow/dtos/run-workflow-version.input';
import { RunWorkflowVersionDTO } from '@/lib/sabcrm/server/src/engine/core-modules/workflow/dtos/run-workflow-version.dto';
import { WorkflowRunDTO } from '@/lib/sabcrm/server/src/engine/core-modules/workflow/dtos/workflow-run.dto';

// ---------------------------------------------------------------------------
// CreatedBy metadata helpers (mirrors buildCreatedByFromFullNameMetadata)
// ---------------------------------------------------------------------------

export type CreatedByMetadata = {
  workspaceMemberId: string;
  name: { firstName: string; lastName: string };
};

// ---------------------------------------------------------------------------
// Service interface (Mongo-backed implementation provided by caller)
// ---------------------------------------------------------------------------

export type WorkflowTriggerWorkspaceService = {
  activateWorkflowVersion(workflowVersionId: string, workspaceId: string): Promise<boolean>;
  deactivateWorkflowVersion(workflowVersionId: string, workspaceId: string): Promise<boolean>;
  runWorkflowVersion(params: {
    workflowVersionId: string;
    workflowRunId?: string;
    payload: Record<string, unknown>;
    createdBy: CreatedByMetadata;
    workspaceId: string;
  }): Promise<RunWorkflowVersionDTO>;
  stopWorkflowRun(workflowRunId: string, workspaceId: string): Promise<WorkflowRunDTO>;
};

// Minimal workspace-member shape the resolver needs
export type WorkspaceMemberInfo = {
  id: string;
  name: { firstName: string; lastName: string };
};

// ---------------------------------------------------------------------------
// Mutations (server actions)
// ---------------------------------------------------------------------------

/** Activate a workflow version (enable its trigger). */
export async function activateWorkflowVersion(
  workspaceId: string,
  workflowVersionId: string,
  service: WorkflowTriggerWorkspaceService,
): Promise<boolean> {
  try {
    return await service.activateWorkflowVersion(workflowVersionId, workspaceId);
  } catch (err) {
    if (err instanceof WorkflowTriggerException) handleWorkflowTriggerException(err);
    throw err;
  }
}

/** Deactivate a workflow version (disable its trigger). */
export async function deactivateWorkflowVersion(
  workspaceId: string,
  workflowVersionId: string,
  service: WorkflowTriggerWorkspaceService,
): Promise<boolean> {
  try {
    return await service.deactivateWorkflowVersion(workflowVersionId, workspaceId);
  } catch (err) {
    if (err instanceof WorkflowTriggerException) handleWorkflowTriggerException(err);
    throw err;
  }
}

/**
 * Manually run a workflow version.
 *
 * The caller is responsible for resolving the authenticated workspace member
 * (workspaceMember) from the session before calling this function.
 */
export async function runWorkflowVersion(
  workspaceId: string,
  workspaceMember: WorkspaceMemberInfo,
  input: RunWorkflowVersionInput,
  service: WorkflowTriggerWorkspaceService,
): Promise<RunWorkflowVersionDTO> {
  try {
    return await service.runWorkflowVersion({
      workflowVersionId: input.workflowVersionId,
      workflowRunId: input.workflowRunId ?? undefined,
      payload: (input.payload as Record<string, unknown>) ?? {},
      createdBy: {
        workspaceMemberId: workspaceMember.id,
        name: workspaceMember.name,
      },
      workspaceId,
    });
  } catch (err) {
    if (err instanceof WorkflowTriggerException) handleWorkflowTriggerException(err);
    throw err;
  }
}

/** Stop an in-progress workflow run. */
export async function stopWorkflowRun(
  workspaceId: string,
  workflowRunId: string,
  service: WorkflowTriggerWorkspaceService,
): Promise<WorkflowRunDTO> {
  try {
    return await service.stopWorkflowRun(workflowRunId, workspaceId);
  } catch (err) {
    if (err instanceof WorkflowTriggerException) handleWorkflowTriggerException(err);
    throw err;
  }
}
