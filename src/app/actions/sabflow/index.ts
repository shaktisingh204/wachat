'use server';

import { createId } from '@paralleldrive/cuid2';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/actions/user.actions';
import { getSabFlowCollection } from '@/lib/sabflow/db';
import type { SabFlowDoc, Group, Variable, SabFlowTheme } from '@/lib/sabflow/types';

/* ── helpers ───────────────────────────────────────────── */

async function requireUser() {
  const session = await getSession();
  const user = session?.user as { id?: string; _id?: string } | undefined;
  const id = user?.id ?? user?._id;
  if (!id) throw new Error('Not authenticated');
  return id;
}

/* ── List flows ────────────────────────────────────────── */
export async function listSabFlows() {
  const userId = await requireUser();
  const col = await getSabFlowCollection();
  const docs = await col
    .find({ userId, status: { $ne: 'ARCHIVED' } })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((d) => ({ ...d, _id: d._id!.toString() }));
}

/* ── Get single flow ───────────────────────────────────── */
export async function getSabFlow(flowId: string) {
  const userId = await requireUser();
  const col = await getSabFlowCollection();
  const doc = await col.findOne({ _id: new ObjectId(flowId), userId });
  if (!doc) return null;
  return { ...doc, _id: doc._id.toString() };
}

/* ── Create flow ───────────────────────────────────────── */
export async function createSabFlow(name: string) {
  const userId = await requireUser();
  const col = await getSabFlowCollection();

  const startGroupId = createId();
  const startBlockId = createId();

  const newFlow: Omit<SabFlowDoc, '_id'> = {
    userId,
    name: name.trim() || 'Untitled flow',
    groups: [
      {
        id: startGroupId,
        title: 'Start',
        graphCoordinates: { x: 200, y: 200 },
        blocks: [
          {
            id: startBlockId,
            type: 'text',
            groupId: startGroupId,
            options: { content: 'Hi! This is the beginning of your flow.' },
          },
        ],
      },
    ],
    edges: [],
    variables: [],
    theme: {},
    settings: {},
    status: 'DRAFT',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await col.insertOne(newFlow as SabFlowDoc);
  revalidatePath('/dashboard/sabflow/flow-builder');
  return { id: result.insertedId.toString() };
}

/* ── Update flow (full save) ───────────────────────────── */
export async function saveSabFlow(
  flowId: string,
  payload: {
    name?: string;
    groups?: Group[];
    edges?: SabFlowDoc['edges'];
    variables?: Variable[];
    theme?: SabFlowTheme;
    settings?: Record<string, unknown>;
    status?: SabFlowDoc['status'];
  },
) {
  const userId = await requireUser();
  const col = await getSabFlowCollection();

  const $set: Record<string, unknown> = { updatedAt: new Date() };
  if (payload.name !== undefined) $set.name = payload.name.trim();
  if (payload.groups !== undefined) $set.groups = payload.groups;
  if (payload.edges !== undefined) $set.edges = payload.edges;
  if (payload.variables !== undefined) $set.variables = payload.variables;
  if (payload.theme !== undefined) $set.theme = payload.theme;
  if (payload.settings !== undefined) $set.settings = payload.settings;
  if (payload.status !== undefined) $set.status = payload.status;

  const result = await col.updateOne(
    { _id: new ObjectId(flowId), userId },
    { $set },
  );

  if (result.matchedCount === 0) return { error: 'Flow not found' };
  return { ok: true };
}

/* ── Rename flow ───────────────────────────────────────── */
export async function renameSabFlow(flowId: string, name: string) {
  const userId = await requireUser();
  const col = await getSabFlowCollection();

  await col.updateOne(
    { _id: new ObjectId(flowId), userId },
    { $set: { name: name.trim(), updatedAt: new Date() } },
  );
  revalidatePath('/dashboard/sabflow/flow-builder');
  return { ok: true };
}

/* ── Delete flow ───────────────────────────────────────── */
export async function deleteSabFlow(flowId: string) {
  const userId = await requireUser();
  const col = await getSabFlowCollection();

  await col.deleteOne({ _id: new ObjectId(flowId), userId });
  revalidatePath('/dashboard/sabflow/flow-builder');
  return { ok: true };
}

/* ── Duplicate flow ────────────────────────────────────── */
export async function duplicateSabFlow(flowId: string) {
  const userId = await requireUser();
  const col = await getSabFlowCollection();

  const source = await col.findOne({ _id: new ObjectId(flowId), userId });
  if (!source) return { error: 'Flow not found' };

  const { _id, ...rest } = source;
  const copy: Omit<SabFlowDoc, '_id'> = {
    ...rest,
    name: `${source.name} (copy)`,
    status: 'DRAFT',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await col.insertOne(copy as SabFlowDoc);
  revalidatePath('/dashboard/sabflow/flow-builder');
  return { id: result.insertedId.toString() };
}
