'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/actions/user.actions';
import { getSabFlowCollection } from '@/lib/sabflow/db';
import type { SabFlowDoc, SabFlowEvent, Group } from '@/lib/sabflow/types';
import { getErrorMessage } from '@/lib/utils';

// ── helpers ────────────────────────────────────────────────────────────────

function defaultStartGroup(): Group {
  return {
    id: crypto.randomUUID(),
    title: 'Group',
    graphCoordinates: { x: 380, y: 200 },
    blocks: [],
  };
}

function defaultStartEvent(): SabFlowEvent {
  return {
    id: crypto.randomUUID(),
    type: 'start',
    graphCoordinates: { x: 100, y: 200 },
  };
}

/** Strip MongoDB _id so the returned object is plain-serialisable JSON. */
function serialize<T extends { _id?: unknown }>(doc: T): Omit<T, '_id'> & { _id: string } {
  const { _id, ...rest } = doc as any;
  return { _id: _id?.toString() ?? '', ...rest };
}

// ── listSabFlows ───────────────────────────────────────────────────────────

export async function listSabFlows(projectId?: string) {
  const session = await getSession();
  if (!session?.user) return { error: 'Authentication required' };

  try {
    const col = await getSabFlowCollection();
    const filter: Record<string, unknown> = { userId: session.user._id.toString() };
    if (projectId) filter.projectId = projectId;

    const docs = await col
      .find(filter, {
        projection: {
          name: 1,
          status: 1,
          groups: 1,
          edges: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      })
      .sort({ updatedAt: -1 })
      .toArray();

    return JSON.parse(JSON.stringify(docs.map(serialize)));
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

// ── getSabFlow ─────────────────────────────────────────────────────────────

export async function getSabFlow(flowId: string) {
  const session = await getSession();
  if (!session?.user) return null;
  if (!ObjectId.isValid(flowId)) return null;

  try {
    const col = await getSabFlowCollection();
    const doc = await col.findOne({
      _id: new ObjectId(flowId),
      userId: session.user._id.toString(),
    });
    if (!doc) return null;

    // Back-fill `events` for flows created before the StartNode feature
    if (!doc.events || !Array.isArray(doc.events) || doc.events.length === 0) {
      (doc as any).events = [defaultStartEvent()];
    }

    return JSON.parse(JSON.stringify(serialize(doc)));
  } catch {
    return null;
  }
}

// ── createSabFlow ──────────────────────────────────────────────────────────

export async function createSabFlow(name: string, projectId?: string) {
  const session = await getSession();
  if (!session?.user) return { error: 'Authentication required' };

  const trimmed = name.trim() || 'Untitled flow';

  const now = new Date();
  const doc: Omit<SabFlowDoc, '_id'> = {
    userId: session.user._id.toString(),
    projectId,
    name: trimmed,
    events: [defaultStartEvent()],
    groups: [defaultStartGroup()],
    edges: [],
    variables: [],
    theme: {},
    settings: {},
    status: 'DRAFT',
    createdAt: now,
    updatedAt: now,
  };

  try {
    const col = await getSabFlowCollection();
    const result = await col.insertOne(doc as SabFlowDoc);
    revalidatePath('/dashboard/sabflow/flow-builder');
    return { id: result.insertedId.toString() };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

// ── saveSabFlow ────────────────────────────────────────────────────────────

export async function saveSabFlow(flowId: string, updates: Partial<SabFlowDoc>) {
  const session = await getSession();
  if (!session?.user) return { error: 'Authentication required' };
  if (!ObjectId.isValid(flowId)) return { error: 'Invalid flow ID' };

  // Never let a caller overwrite ownership / audit fields via this function.
  const { _id, userId, createdAt, ...safeUpdates } = updates as any;

  try {
    const col = await getSabFlowCollection();
    const result = await col.updateOne(
      { _id: new ObjectId(flowId), userId: session.user._id.toString() },
      { $set: { ...safeUpdates, updatedAt: new Date() } },
    );

    if (result.matchedCount === 0) return { error: 'Flow not found or access denied' };

    revalidatePath(`/dashboard/sabflow/flow-builder/${flowId}`);
    revalidatePath('/dashboard/sabflow/flow-builder');
    return { ok: true };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

// ── deleteSabFlow ──────────────────────────────────────────────────────────

export async function deleteSabFlow(flowId: string) {
  const session = await getSession();
  if (!session?.user) return { error: 'Authentication required' };
  if (!ObjectId.isValid(flowId)) return { error: 'Invalid flow ID' };

  try {
    const col = await getSabFlowCollection();
    const result = await col.deleteOne({
      _id: new ObjectId(flowId),
      userId: session.user._id.toString(),
    });

    if (result.deletedCount === 0) return { error: 'Flow not found or access denied' };

    revalidatePath('/dashboard/sabflow/flow-builder');
    return { ok: true };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

// ── duplicateSabFlow ───────────────────────────────────────────────────────

export async function duplicateSabFlow(flowId: string) {
  const session = await getSession();
  if (!session?.user) return { error: 'Authentication required' };
  if (!ObjectId.isValid(flowId)) return { error: 'Invalid flow ID' };

  try {
    const col = await getSabFlowCollection();
    const original = await col.findOne({
      _id: new ObjectId(flowId),
      userId: session.user._id.toString(),
    });
    if (!original) return { error: 'Flow not found or access denied' };

    const { _id, createdAt, updatedAt, publicId, ...rest } = original as any;
    const now = new Date();
    const copy: Omit<SabFlowDoc, '_id'> = {
      ...rest,
      name: `${original.name} (copy)`,
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    };

    const result = await col.insertOne(copy as SabFlowDoc);
    revalidatePath('/dashboard/sabflow/flow-builder');
    return { id: result.insertedId.toString() };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}
