// PORT: dto
// Original: NestJS @ObjectType(); trigger/steps from WorkflowTrigger/WorkflowAction types

// WorkflowVersionStatus from workflow-version.workspace-entity
export enum WorkflowVersionStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  DEACTIVATED = 'DEACTIVATED',
  ARCHIVED = 'ARCHIVED',
}

// Inline minimal shapes; full discriminated unions live in the shared layer
export type WorkflowVersionDTO = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  workflowId: string;
  status: WorkflowVersionStatus;
  trigger: Record<string, unknown> | null;
  steps: Record<string, unknown>[] | null;
};
