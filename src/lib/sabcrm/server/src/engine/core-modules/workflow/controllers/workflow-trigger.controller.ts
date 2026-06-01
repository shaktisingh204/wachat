import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: Original was a NestJS @Controller('webhooks') with Express guards.
// Ported as plain async server functions usable from Next.js API route handlers.
// Exception types reference ported exception classes; callers should map them to
// HTTP status codes (404 -> NOT_FOUND, 400 -> invalid status, etc.).

export class WorkflowTriggerException extends Error {
  readonly code: WorkflowTriggerExceptionCode;
  constructor(message: string, code: WorkflowTriggerExceptionCode) {
    super(message);
    this.name = "WorkflowTriggerException";
    this.code = code;
  }
}

export enum WorkflowTriggerExceptionCode {
  NOT_FOUND = "NOT_FOUND",
  INVALID_WORKFLOW_STATUS = "INVALID_WORKFLOW_STATUS",
  INVALID_WORKFLOW_VERSION = "INVALID_WORKFLOW_VERSION",
  INVALID_WORKFLOW_TRIGGER = "INVALID_WORKFLOW_TRIGGER",
}

export type WorkflowRunResult = {
  workflowName: string;
  success: boolean;
  workflowRunId: string;
};

async function getWorkspaceCollection(workspaceId: string, name: string) {
  const { db } = await connectToDatabase();
  return db.collection(`sabcrm_${name}_${workspaceId}`);
}

async function workspaceExists(workspaceId: string): Promise<boolean> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_workspace");
  const found = await col.findOne({ id: workspaceId });
  return found !== null;
}

/**
 * POST /webhooks/workflows/:workspaceId/:workflowId
 * Trigger a workflow via webhook with an optional JSON body payload.
 */
export async function runWorkflowByPostRequest(
  workspaceId: string,
  workflowId: string,
  payload: object = {}
): Promise<WorkflowRunResult> {
  return runWorkflow({ workflowId, payload, workspaceId });
}

/**
 * GET /webhooks/workflows/:workspaceId/:workflowId
 * Trigger a workflow via webhook with no payload.
 */
export async function runWorkflowByGetRequest(
  workspaceId: string,
  workflowId: string
): Promise<WorkflowRunResult> {
  return runWorkflow({ workflowId, workspaceId });
}

async function runWorkflow({
  workflowId,
  payload = {},
  workspaceId,
}: {
  workflowId: string;
  payload?: object;
  workspaceId: string;
}): Promise<WorkflowRunResult> {
  const exists = await workspaceExists(workspaceId);

  if (!exists) {
    throw new WorkflowTriggerException(
      `[Webhook trigger] Workspace ${workspaceId} not found`,
      WorkflowTriggerExceptionCode.NOT_FOUND
    );
  }

  const workflowCol = await getWorkspaceCollection(workspaceId, "workflow");
  const workflow = await workflowCol.findOne({ id: workflowId });

  if (!workflow) {
    throw new WorkflowTriggerException(
      `[Webhook trigger] Workflow ${workflowId} not found in workspace ${workspaceId}`,
      WorkflowTriggerExceptionCode.NOT_FOUND
    );
  }

  const lastPublishedVersionId = (workflow as Record<string, unknown>).lastPublishedVersionId as string | undefined;

  if (!lastPublishedVersionId || lastPublishedVersionId === "") {
    throw new WorkflowTriggerException(
      `[Webhook trigger] Workflow ${workflowId} has not been activated in workspace ${workspaceId}`,
      WorkflowTriggerExceptionCode.INVALID_WORKFLOW_STATUS
    );
  }

  const versionCol = await getWorkspaceCollection(
    workspaceId,
    "workflow_version"
  );
  const workflowVersion = await versionCol.findOne({
    id: lastPublishedVersionId,
  });

  if (!workflowVersion) {
    throw new WorkflowTriggerException(
      `[Webhook trigger] No workflow version activated for workflow ${workflowId} in workspace ${workspaceId}`,
      WorkflowTriggerExceptionCode.INVALID_WORKFLOW_VERSION
    );
  }

  const trigger = (workflowVersion as Record<string, unknown>).trigger as
    | { type?: string }
    | undefined;

  if (trigger?.type !== "WEBHOOK") {
    throw new WorkflowTriggerException(
      `[Webhook trigger] Workflow ${workflowId} does not have a Webhook trigger in workspace ${workspaceId}`,
      WorkflowTriggerExceptionCode.INVALID_WORKFLOW_TRIGGER
    );
  }

  const status = (workflowVersion as Record<string, unknown>).status as string | undefined;

  if (status !== "ACTIVE") {
    throw new WorkflowTriggerException(
      `[Webhook trigger] Workflow version ${workflowVersion._id} is not active in workspace ${workspaceId}`,
      WorkflowTriggerExceptionCode.INVALID_WORKFLOW_STATUS
    );
  }

  // PORT-NOTE: Original called WorkflowTriggerWorkspaceService.runWorkflowVersion
  // which enqueued the run via BullMQ. That service is ported separately.
  // Here we record the run intent in Mongo and return a synthetic run ID.
  const { db } = await connectToDatabase();
  const runsCol = db.collection("sabcrm_workflow_run");
  const workflowRunId = crypto.randomUUID();

  await runsCol.insertOne({
    id: workflowRunId,
    workflowId,
    workflowVersionId: lastPublishedVersionId,
    workspaceId,
    payload,
    status: "PENDING",
    createdAt: new Date(),
    createdBy: {
      source: "WEBHOOK",
      workspaceMemberId: null,
      name: "Webhook",
      context: {},
    },
  });

  return {
    workflowName: (workflow as Record<string, unknown>).name as string,
    success: true,
    workflowRunId,
  };
}
