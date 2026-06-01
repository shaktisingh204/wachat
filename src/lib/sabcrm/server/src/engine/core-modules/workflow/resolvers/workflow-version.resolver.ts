import "server-only";

// PORT-NOTE: NestJS GraphQL resolver ported to plain server-action-style exported functions.
// Inputs/outputs match the original mutations. Auth/guard logic is noted inline.

import type { CreateDraftFromWorkflowVersionInput } from "@/lib/sabcrm/server/src/engine/core-modules/workflow/dtos/create-draft-from-workflow-version.input";
import type { DuplicateWorkflowInput } from "@/lib/sabcrm/server/src/engine/core-modules/workflow/dtos/duplicate-workflow.input";
import type { UpdateWorkflowVersionPositionsInput } from "@/lib/sabcrm/server/src/engine/core-modules/workflow/dtos/update-workflow-version-positions.input";
import type { WorkflowVersionDTO } from "@/lib/sabcrm/server/src/engine/core-modules/workflow/dtos/workflow-version.dto";
import type { WorkflowVersionWorkspaceService } from "@/lib/sabcrm/server/src/modules/workflow/workflow-builder/workflow-version/workflow-version.workspace-service";

// PORT-NOTE: Guard: WorkspaceAuthGuard + UserAuthGuard + SettingsPermissionGuard(WORKFLOWS)
// Callers must verify workspace membership and WORKFLOWS permission before invoking.

export async function createDraftFromWorkflowVersion(
  workflowVersionWorkspaceService: WorkflowVersionWorkspaceService,
  workspaceId: string,
  input: CreateDraftFromWorkflowVersionInput,
): Promise<WorkflowVersionDTO> {
  const { workflowId, workflowVersionIdToCopy } = input;

  return workflowVersionWorkspaceService.createDraftFromWorkflowVersion({
    workspaceId,
    workflowId,
    workflowVersionIdToCopy,
  });
}

export async function duplicateWorkflow(
  workflowVersionWorkspaceService: WorkflowVersionWorkspaceService,
  workspaceId: string,
  input: DuplicateWorkflowInput,
): Promise<WorkflowVersionDTO> {
  const { workflowIdToDuplicate, workflowVersionIdToCopy } = input;

  return workflowVersionWorkspaceService.duplicateWorkflow({
    workspaceId,
    workflowIdToDuplicate,
    workflowVersionIdToCopy,
  });
}

export async function updateWorkflowVersionPositions(
  workflowVersionWorkspaceService: WorkflowVersionWorkspaceService,
  workspaceId: string,
  input: UpdateWorkflowVersionPositionsInput,
): Promise<boolean> {
  const { workflowVersionId, positions } = input;

  await workflowVersionWorkspaceService.updateWorkflowVersionPositions({
    workspaceId,
    workflowVersionId,
    positions,
  });

  return true;
}
