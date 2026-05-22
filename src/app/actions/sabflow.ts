'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/actions/user.actions';
import { getSabFlowCollection, getTodaySubmissionCount } from '@/lib/sabflow/db';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import { getErrorMessage } from '@/lib/utils';
import { upsertFlowWebhooks, deactivateFlowWebhooks } from '@/lib/sabflow/db';
import type { WebhookEventOptions } from '@/lib/sabflow/types';
import { serializeDoc, serializeForClient } from '@/lib/sabflow/serializeForClient';
import { registerTriggerBlocks, deregisterTriggerBlocks } from '@/lib/sabflow/triggers/manager';
import { listFlowWebhooks } from '@/lib/sabflow/db';

// ── helpers ────────────────────────────────────────────────────────────────

// New flows now open onto an empty canvas with the trigger picker — matching
// n8n's "What triggers this workflow?" experience. The user explicitly chooses
// the first trigger rather than having a default 'start' event auto-created.

/**
 * Sanitize a Mongo doc for RSC streaming. Delegates to the canonical helper
 * in `@/lib/sabflow/serializeForClient` so every sabflow surface shares the
 * same BSON-handling rules (ObjectId, Date, Decimal128, Binary, Long, Buffer,
 * Map, Set are all stripped to JSON-safe primitives).
 */
function serialize<T extends { _id?: unknown }>(doc: T) {
  return serializeDoc(doc);
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
          tags: 1,
          folderId: 1,
        },
      })
      .sort({ updatedAt: -1 })
      .toArray();

    return docs.map(serialize);
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

    // Normalize `events` to an empty array for legacy flows that never had it.
    // The trigger picker shows on the canvas when this is empty.
    if (!doc.events || !Array.isArray(doc.events)) {
      (doc as any).events = [];
    }

    return serialize(doc);
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
    events: [],
    groups: [],
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

export async function saveSabFlow(
  flowId: string,
  updates: Partial<SabFlowDoc>,
  options?: { expectedVersion?: number },
) {
  const session = await getSession();
  if (!session?.user) return { error: 'Authentication required' };
  if (!ObjectId.isValid(flowId)) return { error: 'Invalid flow ID' };

  // Never let a caller overwrite ownership / audit fields via this function.
  // Also strip `version` from updates — managed server-side via $inc (Step 34).
  const { _id, userId, createdAt, version: _ignoreVersion, ...safeUpdates } =
    updates as any;

  try {
    const col = await getSabFlowCollection();
    const filter: Record<string, unknown> = {
      _id: new ObjectId(flowId),
      userId: session.user._id.toString(),
    };
    if (typeof options?.expectedVersion === 'number') {
      // Match the current version OR a missing field (legacy docs).
      filter.$or = [
        { version: options.expectedVersion },
        ...(options.expectedVersion === 0
          ? [{ version: { $exists: false } }]
          : []),
      ];
    }

    const result = await col.updateOne(filter, {
      $set: { ...safeUpdates, updatedAt: new Date() },
      $inc: { version: 1 },
    });

    if (result.matchedCount === 0) {
      // Distinguish "wrong version" from "doesn't exist / not yours".
      const exists = await col.findOne(
        {
          _id: new ObjectId(flowId),
          userId: session.user._id.toString(),
        },
        { projection: { version: 1, updatedAt: 1 } },
      );
      if (exists) {
        return {
          error: 'Version conflict — another editor changed this flow.',
          code: 'version_conflict' as const,
          currentVersion: exists.version ?? 0,
          updatedAt: exists.updatedAt,
        };
      }
      return { error: 'Flow not found or access denied' };
    }

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

// ── activateSabFlow / deactivateSabFlow ────────────────────────────────────

/**
 * Set a flow live.  Writes `status: 'PUBLISHED'` to MongoDB and calls the
 * Rust engine's /activate endpoint so it can register any webhook triggers.
 * The Rust call is best-effort — a failure there does NOT roll back the DB
 * write, because the worker can still pick up the flow by querying status.
 */
export async function activateSabFlow(
  flowId: string,
): Promise<{ ok: true; webhooks?: Array<{ appEvent: string; webhookId: string; webhookUrl: string }> } | { error: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Authentication required' };
  if (!ObjectId.isValid(flowId)) return { error: 'Invalid flow ID' };

  const userId = session.user._id.toString();

  try {
    const col = await getSabFlowCollection();
    const flow = await col.findOneAndUpdate(
      { _id: new ObjectId(flowId), userId },
      { $set: { status: 'PUBLISHED', updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!flow) return { error: 'Flow not found or access denied' };

    // Register webhook URLs for any webhook-type trigger events
    let webhookResults: Array<{ appEvent: string; webhookId: string; webhookUrl: string }> | undefined;
    const webhookEvents = (flow.events ?? []).filter((e) => e.type === 'webhook');
    if (webhookEvents.length > 0) {
      const opts = webhookEvents.map((e) => {
        const o = e.options as WebhookEventOptions | undefined;
        return {
          appEvent: e.appEvent ?? 'webhook_received',
          method: o?.method ?? 'ANY',
          authentication: o?.authentication ?? 'none',
          authHeaderName: o?.authHeaderName,
          authHeaderValue: o?.authHeaderValue,
          responseMode: o?.responseMode ?? 'immediately',
        };
      });
      const registered = await upsertFlowWebhooks(flowId, userId, opts);
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
      webhookResults = registered.map((r) => ({
        ...r,
        webhookUrl: `${baseUrl}/api/sabflow/webhook/${r.webhookId}`,
      }));

      // Trigger hooks
      await registerTriggerBlocks(flow, userId, webhookResults);
    }

    // Fire-and-forget to Rust engine — imports lazily to avoid loading fetcher in every bundle.
    try {
      const { rustFetch } = await import('@/lib/rust-client/fetcher');
      await rustFetch(`/v1/sabflow/flows/${flowId}/activate`, { method: 'POST' });
    } catch {
      // non-fatal: Rust engine may not be up; flow status is already written
    }

    revalidatePath(`/dashboard/sabflow/flow-builder/${flowId}`);
    revalidatePath('/dashboard/sabflow');
    return webhookResults ? { ok: true, webhooks: webhookResults } : { ok: true };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

/**
 * Take a flow offline.  Mirrors `activateSabFlow` but sets status to 'DRAFT'.
 */
export async function deactivateSabFlow(flowId: string): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Authentication required' };
  if (!ObjectId.isValid(flowId)) return { error: 'Invalid flow ID' };

  const userId = session.user._id.toString();

  try {
    const col = await getSabFlowCollection();
    const result = await col.updateOne(
      { _id: new ObjectId(flowId), userId },
      { $set: { status: 'DRAFT', updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) return { error: 'Flow not found or access denied' };

    // Deactivate all webhook registrations for this flow
    const existingWebhooks = await listFlowWebhooks(userId, flowId);
    const flowData = await col.findOne({ _id: new ObjectId(flowId), userId });
    if (flowData) {
      await deregisterTriggerBlocks(flowData, userId, existingWebhooks);
    }
    await deactivateFlowWebhooks(flowId, userId);

    try {
      const { rustFetch } = await import('@/lib/rust-client/fetcher');
      await rustFetch(`/v1/sabflow/flows/${flowId}/deactivate`, { method: 'POST' });
    } catch {
      // non-fatal
    }

    revalidatePath(`/dashboard/sabflow/flow-builder/${flowId}`);
    revalidatePath('/dashboard/sabflow');
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

// ── getTodaySubmissionCounts ───────────────────────────────────────────────

/**
 * Returns today's submission count for each of the given flowIds.
 * Result is a plain record: flowId → count.
 * Flows the user doesn't own are silently omitted.
 */
export async function getTodaySubmissionCounts(
  flowIds: string[],
): Promise<Record<string, number>> {
  const session = await getSession();
  if (!session?.user) return {};
  if (flowIds.length === 0) return {};

  try {
    const counts = await Promise.all(
      flowIds.map(async (id) => [id, await getTodaySubmissionCount(id)] as const),
    );
    return Object.fromEntries(counts);
  } catch {
    return {};
  }
}
