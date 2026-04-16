/**
 * Database operations for N8N workflow persistence.
 *
 * Collections:
 *   n8n_workflows   — N8NWorkflow documents
 *   n8n_executions  — WorkflowExecution records
 */

import 'server-only';

import { ObjectId, type Collection, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { N8NWorkflow, WorkflowExecution } from './types';

/* ── Collection accessors ─────────────────────────────────── */

async function getWorkflowCollection(): Promise<Collection<N8NWorkflow>> {
  const { db } = await connectToDatabase();
  return db.collection<N8NWorkflow>('n8n_workflows');
}

async function getExecutionCollection(): Promise<Collection<WorkflowExecution>> {
  const { db } = await connectToDatabase();
  return db.collection<WorkflowExecution>('n8n_executions');
}

/* ── Workflow CRUD ─────────────────────────────────────────── */

/**
 * Upsert a workflow by its `id` string field.
 * If the document already has an `_id` it is updated in-place; otherwise
 * a new document is inserted.
 */
export async function saveWorkflow(workflow: N8NWorkflow): Promise<void> {
  const col = await getWorkflowCollection();
  const now = new Date();

  if (workflow._id) {
    const { _id, ...rest } = workflow;
    await col.updateOne(
      { _id: new ObjectId(_id) },
      {
        $set: {
          ...rest,
          updatedAt: now,
        },
      },
      { upsert: false }
    );
  } else {
    await col.insertOne({
      ...workflow,
      createdAt: workflow.createdAt ?? now,
      updatedAt: now,
    } as N8NWorkflow);
  }
}

/**
 * Retrieve a workflow by its string `id` field (NOT MongoDB _id).
 */
export async function getWorkflow(id: string): Promise<N8NWorkflow | null> {
  const col = await getWorkflowCollection();
  const doc = await col.findOne({ id } as Partial<N8NWorkflow>);
  if (!doc) return null;
  return mongoDocToWorkflow(doc);
}

/**
 * Retrieve a workflow by its MongoDB ObjectId.
 */
export async function getWorkflowByObjectId(
  objectId: string | ObjectId
): Promise<N8NWorkflow | null> {
  const col = await getWorkflowCollection();
  const oid = typeof objectId === 'string' ? new ObjectId(objectId) : objectId;
  const doc = await col.findOne({ _id: oid });
  if (!doc) return null;
  return mongoDocToWorkflow(doc);
}

/**
 * List all workflows belonging to a user.
 * Sorted by updatedAt descending (most recently modified first).
 */
export async function listWorkflows(userId: string): Promise<N8NWorkflow[]> {
  const col = await getWorkflowCollection();
  const docs = await col
    .find({ userId } as Partial<N8NWorkflow>)
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map(mongoDocToWorkflow);
}

/**
 * Soft-delete a workflow (sets a `deletedAt` timestamp).
 * To hard-delete pass `hard: true`.
 */
export async function deleteWorkflow(
  id: string,
  options: { hard?: boolean } = {}
): Promise<void> {
  const col = await getWorkflowCollection();
  if (options.hard) {
    await col.deleteOne({ id } as Partial<N8NWorkflow>);
  } else {
    await col.updateOne(
      { id } as Partial<N8NWorkflow>,
      { $set: { deletedAt: new Date() } as unknown as Partial<N8NWorkflow> }
    );
  }
}

/**
 * Toggle the `active` flag on a workflow (enable/disable triggers).
 */
export async function setWorkflowActive(id: string, active: boolean): Promise<void> {
  const col = await getWorkflowCollection();
  await col.updateOne(
    { id } as Partial<N8NWorkflow>,
    { $set: { active, updatedAt: new Date() } as Partial<N8NWorkflow> }
  );
}

/* ── Execution persistence ─────────────────────────────────── */

/**
 * Persist a completed (or in-progress) workflow execution.
 */
export async function saveExecution(execution: WorkflowExecution): Promise<void> {
  const col = await getExecutionCollection();
  await col.updateOne(
    { id: execution.id } as Partial<WorkflowExecution>,
    { $set: execution as Partial<WorkflowExecution> },
    { upsert: true }
  );
}

/**
 * Retrieve a single execution by its string id.
 */
export async function getExecution(id: string): Promise<WorkflowExecution | null> {
  const col = await getExecutionCollection();
  const doc = await col.findOne({ id } as Partial<WorkflowExecution>);
  if (!doc) return null;
  return mongoDocToExecution(doc);
}

/**
 * List all executions for a workflow, newest first.
 * Optionally limit the number of results.
 */
export async function getExecutions(
  workflowId: string,
  options: { limit?: number; status?: WorkflowExecution['status'] } = {}
): Promise<WorkflowExecution[]> {
  const col = await getExecutionCollection();

  const filter: Partial<WorkflowExecution> = { workflowId };
  if (options.status) filter.status = options.status;

  const docs = await col
    .find(filter as Partial<WorkflowExecution>)
    .sort({ startedAt: -1 })
    .limit(options.limit ?? 100)
    .toArray();

  return docs.map(mongoDocToExecution);
}

/**
 * Count executions by status for a given workflow.
 */
export async function countExecutions(
  workflowId: string
): Promise<Record<WorkflowExecution['status'], number>> {
  const col = await getExecutionCollection();
  const results = await col
    .aggregate<{ _id: string; count: number }>([
      { $match: { workflowId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])
    .toArray();

  const counts: Record<string, number> = {
    running: 0,
    success: 0,
    error: 0,
    waiting: 0,
  };
  for (const r of results) {
    counts[r._id] = r.count;
  }
  return counts as Record<WorkflowExecution['status'], number>;
}

/* ── Internal serialisation helpers ───────────────────────── */

function mongoDocToWorkflow(doc: WithId<N8NWorkflow>): N8NWorkflow {
  const { _id, ...rest } = doc;
  return { ...rest, _id } as N8NWorkflow;
}

function mongoDocToExecution(
  doc: WithId<WorkflowExecution> & { _id?: ObjectId }
): WorkflowExecution {
  const { _id: _omit, ...rest } = doc;
  return rest as WorkflowExecution;
}
