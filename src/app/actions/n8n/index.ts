'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { createId } from '@paralleldrive/cuid2';
import { getSession } from '@/app/actions/user.actions';
import {
  listWorkflows,
  getWorkflowByObjectId,
  saveWorkflow as dbSaveWorkflow,
  deleteWorkflow as dbDeleteWorkflow,
  setWorkflowActive,
  saveExecution,
  getExecutions,
  countExecutions,
} from '@/lib/n8n/db';
import type { N8NWorkflow, WorkflowExecution } from '@/lib/n8n/types';

/* ── helpers ─────────────────────────────────────────────────── */

async function requireUser(): Promise<string> {
  const session = await getSession();
  const user = session?.user as { id?: string; _id?: string } | undefined;
  const userId = user?.id ?? user?._id;
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

/* ── List workflows ──────────────────────────────────────────── */

export async function listN8NWorkflows(): Promise<any[]> {
  const userId = await requireUser();
  const workflows = await listWorkflows(userId);

  return Promise.all(
    workflows.map(async (wf) => {
      const [latest] = await getExecutions(wf.id, { limit: 1 });
      const counts = await countExecutions(wf.id);
      const totalExecutions = Object.values(counts).reduce((a, b) => a + b, 0);

      return {
        ...wf,
        _id: wf._id?.toString() || wf.id,
        lastRunAt: latest ? (latest.startedAt || latest.finishedAt) : undefined,
        lastRunStatus: latest ? latest.status : null,
        executionsCount: totalExecutions,
      };
    })
  );
}

/* ── Get single workflow ─────────────────────────────────────── */

export async function getN8NWorkflow(
  workflowId: string,
): Promise<N8NWorkflow | null> {
  const userId = await requireUser();
  const workflow = await getWorkflowByObjectId(workflowId);
  if (!workflow || workflow.userId !== userId) return null;
  return workflow;
}

/* ── Create workflow ─────────────────────────────────────────── */

export async function createWorkflow(
  data: Partial<N8NWorkflow>,
): Promise<N8NWorkflow> {
  const userId = await requireUser();

  const now = new Date();
  const newWorkflow: N8NWorkflow = {
    id: createId(),
    userId,
    name: data.name?.trim() || 'Untitled Workflow',
    active: false,
    nodes: data.nodes ?? [],
    connections: data.connections ?? {},
    settings: data.settings ?? { executionOrder: 'v1' },
    staticData: data.staticData,
    tags: data.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };

  await dbSaveWorkflow(newWorkflow);
  revalidatePath('/dashboard/n8n');
  return newWorkflow;
}

/* ── Save workflow (partial update) ─────────────────────────── */

export async function saveWorkflow(
  id: string,
  updates: Partial<N8NWorkflow>,
): Promise<void> {
  const userId = await requireUser();

  const existing = await getWorkflowByObjectId(id);
  if (!existing || existing.userId !== userId) throw new Error('Workflow not found');

  const updated: N8NWorkflow = {
    ...existing,
    ...updates,
    // Never allow userId to be overwritten
    userId,
    updatedAt: new Date(),
  };
  if (updates.name !== undefined) updated.name = updates.name.trim();

  await dbSaveWorkflow(updated);
  revalidatePath('/dashboard/n8n');
}

/* ── Delete workflow ─────────────────────────────────────────── */

export async function deleteWorkflow(id: string): Promise<void> {
  const userId = await requireUser();
  const existing = await getWorkflowByObjectId(id);
  if (!existing || existing.userId !== userId) throw new Error('Workflow not found');

  await dbDeleteWorkflow(existing.id, { hard: true });
  revalidatePath('/dashboard/n8n');
}

/* ── Bulk Delete workflows ───────────────────────────────────── */

export async function bulkDeleteWorkflows(ids: string[]): Promise<void> {
  const userId = await requireUser();
  for (const id of ids) {
    const existing = await getWorkflowByObjectId(id);
    if (existing && existing.userId === userId) {
      await dbDeleteWorkflow(existing.id, { hard: true });
    }
  }
  revalidatePath('/dashboard/n8n');
}

/* ── Activate workflow ───────────────────────────────────────── */

export async function activateWorkflow(id: string): Promise<void> {
  const userId = await requireUser();
  const existing = await getWorkflowByObjectId(id);
  if (!existing || existing.userId !== userId) throw new Error('Workflow not found');

  await setWorkflowActive(existing.id, true);
  revalidatePath('/dashboard/n8n');
}

/* ── Bulk Activate workflows ─────────────────────────────────── */

export async function bulkActivateWorkflows(ids: string[]): Promise<void> {
  const userId = await requireUser();
  for (const id of ids) {
    const existing = await getWorkflowByObjectId(id);
    if (existing && existing.userId === userId) {
      await setWorkflowActive(existing.id, true);
    }
  }
  revalidatePath('/dashboard/n8n');
}

/* ── Deactivate workflow ─────────────────────────────────────── */

export async function deactivateWorkflow(id: string): Promise<void> {
  const userId = await requireUser();
  const existing = await getWorkflowByObjectId(id);
  if (!existing || existing.userId !== userId) throw new Error('Workflow not found');

  await setWorkflowActive(existing.id, false);
  revalidatePath('/dashboard/n8n');
}

/* ── Bulk Deactivate workflows ───────────────────────────────── */

export async function bulkDeactivateWorkflows(ids: string[]): Promise<void> {
  const userId = await requireUser();
  for (const id of ids) {
    const existing = await getWorkflowByObjectId(id);
    if (existing && existing.userId === userId) {
      await setWorkflowActive(existing.id, false);
    }
  }
  revalidatePath('/dashboard/n8n');
}

/* ── Execute workflow manually ───────────────────────────────── */

/**
 * Queues a manual execution for the workflow. Returns an executionId
 * that can be polled for status. The actual run is handled by the
 * PM2 worker process; this action inserts a "running" execution record
 * and returns the id.
 */
export async function executeWorkflowManually(
  id: string,
  data?: Record<string, unknown>,
): Promise<string> {
  const userId = await requireUser();
  const existing = await getWorkflowByObjectId(id);
  if (!existing || existing.userId !== userId) throw new Error('Workflow not found');

  const executionId = createId();
  const execution: WorkflowExecution = {
    id: executionId,
    workflowId: existing.id,
    status: 'running',
    startedAt: new Date(),
    nodeExecutions: [],
  };

  await saveExecution(execution);

  // TODO: push { executionId, workflowId: existing.id, inputData: data }
  //       to the n8n execution queue (Redis / PM2 worker).
  console.log('[n8n] manual execution queued', {
    executionId,
    workflowId: existing.id,
    data,
  });

  revalidatePath('/dashboard/n8n');
  return executionId;
}
