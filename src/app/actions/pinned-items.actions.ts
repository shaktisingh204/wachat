'use server';

/**
 * Pinned items — viewer-scoped pin/unpin across CRM entities.
 *
 * Backed by the `crm_pinned_items` collection (also used by
 * `worksuite/dashboard.actions.ts`). This file is the dashboard-facing
 * adapter with a simpler API:
 *
 *   togglePin(entityType, entityId)        // flip on/off
 *   isPinned(entityType, entityId)         // single check
 *   getMyPinnedItems()                     // grouped by entity type
 *   reorderPinned(entityType, orderedIds)  // drag-drop reorder
 *   unpin(entityType, entityId)            // explicit unpin
 *
 * Every row is tenant-scoped (`userId`) AND viewer-scoped (`user_id`).
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';

export type PinnableEntityType =
  | 'task'
  | 'project'
  | 'lead'
  | 'deal'
  | 'ticket'
  | 'invoice'
  | 'contact'
  | 'kb'
  | 'note';

export interface PinnedItem {
  _id: string;
  entityType: PinnableEntityType;
  entityId: string;
  title: string;
  pinnedAt: string;
  position: number;
}

export interface GroupedPinned {
  entityType: PinnableEntityType;
  items: PinnedItem[];
}

const COL = 'crm_pinned_items';
const REVALIDATE_PATHS = ['/dashboard/crm', '/dashboard/crm/pinned'];

async function requireUserIds(): Promise<{
  tenantId: ObjectId;
  viewerId: ObjectId;
} | null> {
  const session = await getSession();
  if (!session?.user?._id) return null;
  const id = new ObjectId(String(session.user._id));
  return { tenantId: id, viewerId: id };
}

function safeIdValue(id: string): unknown {
  return ObjectId.isValid(id) ? new ObjectId(id) : id;
}

function isoOrNow(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return new Date().toISOString();
}

function rowToItem(row: Record<string, unknown>): PinnedItem {
  return {
    _id: String(row._id),
    entityType: row.resource_type as PinnableEntityType,
    entityId: String(row.resource_id),
    title: typeof row.title === 'string' ? row.title : '',
    pinnedAt: isoOrNow(row.pinned_at ?? row.createdAt),
    position:
      typeof row.position === 'number' ? (row.position as number) : 0,
  };
}

export async function togglePin(
  entityType: PinnableEntityType,
  entityId: string,
  title?: string,
): Promise<{ pinned?: boolean; ok?: boolean; error?: string }> {
  try {
    const ids = await requireUserIds();
    if (!ids) return { error: 'Not authenticated.' };
    if (!entityType || !entityId) return { error: 'Missing arguments.' };

    const { db } = await connectToDatabase();
    const rid = safeIdValue(entityId);
    const filter = {
      userId: ids.tenantId,
      user_id: ids.viewerId,
      resource_type: entityType,
      resource_id: rid,
    };

    const existing = await db.collection(COL).findOne(filter);
    if (existing) {
      await db.collection(COL).deleteOne({ _id: existing._id });
      for (const p of REVALIDATE_PATHS) revalidatePath(p);
      return { ok: true, pinned: false };
    }

    // Find the next position for this entity type (append at end).
    const last = await db
      .collection(COL)
      .find({
        userId: ids.tenantId,
        user_id: ids.viewerId,
        resource_type: entityType,
      })
      .sort({ position: -1 })
      .limit(1)
      .toArray();
    const nextPos =
      typeof last[0]?.position === 'number' ? (last[0].position as number) + 1 : 0;

    const now = new Date();
    await db.collection(COL).insertOne({
      ...filter,
      title: title ?? '',
      position: nextPos,
      pinned_at: now,
      createdAt: now,
      updatedAt: now,
    });
    for (const p of REVALIDATE_PATHS) revalidatePath(p);
    return { ok: true, pinned: true };
  } catch (e: unknown) {
    return { error: getErrorMessage(e) };
  }
}

export async function isPinned(
  entityType: PinnableEntityType,
  entityId: string,
): Promise<boolean> {
  try {
    const ids = await requireUserIds();
    if (!ids) return false;
    if (!entityType || !entityId) return false;
    const { db } = await connectToDatabase();
    const rid = safeIdValue(entityId);
    const row = await db.collection(COL).findOne({
      userId: ids.tenantId,
      user_id: ids.viewerId,
      resource_type: entityType,
      resource_id: rid,
    });
    return Boolean(row);
  } catch {
    return false;
  }
}

export async function unpin(
  entityType: PinnableEntityType,
  entityId: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const ids = await requireUserIds();
    if (!ids) return { error: 'Not authenticated.' };
    const { db } = await connectToDatabase();
    const rid = safeIdValue(entityId);
    await db.collection(COL).deleteOne({
      userId: ids.tenantId,
      user_id: ids.viewerId,
      resource_type: entityType,
      resource_id: rid,
    });
    for (const p of REVALIDATE_PATHS) revalidatePath(p);
    return { ok: true };
  } catch (e: unknown) {
    return { error: getErrorMessage(e) };
  }
}

export async function getMyPinnedItems(): Promise<GroupedPinned[]> {
  try {
    const ids = await requireUserIds();
    if (!ids) return [];
    const { db } = await connectToDatabase();
    const rows = await db
      .collection(COL)
      .find({ userId: ids.tenantId, user_id: ids.viewerId })
      .sort({ resource_type: 1, position: 1, pinned_at: -1 })
      .toArray();

    const byType = new Map<PinnableEntityType, PinnedItem[]>();
    for (const r of rows) {
      const item = rowToItem(r as Record<string, unknown>);
      const arr = byType.get(item.entityType) ?? [];
      arr.push(item);
      byType.set(item.entityType, arr);
    }
    return Array.from(byType.entries()).map(([entityType, items]) => ({
      entityType,
      items,
    }));
  } catch {
    return [];
  }
}

export async function reorderPinned(
  entityType: PinnableEntityType,
  orderedIds: string[],
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const ids = await requireUserIds();
    if (!ids) return { error: 'Not authenticated.' };
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return { error: 'No order provided.' };
    }
    const { db } = await connectToDatabase();
    const ops = orderedIds
      .filter((id) => ObjectId.isValid(id))
      .map((id, idx) => ({
        updateOne: {
          filter: {
            _id: new ObjectId(id),
            userId: ids.tenantId,
            user_id: ids.viewerId,
            resource_type: entityType,
          },
          update: { $set: { position: idx, updatedAt: new Date() } },
        },
      }));
    if (ops.length === 0) return { error: 'No valid ids.' };
    await db.collection(COL).bulkWrite(ops);
    for (const p of REVALIDATE_PATHS) revalidatePath(p);
    return { ok: true };
  } catch (e: unknown) {
    return { error: getErrorMessage(e) };
  }
}
