'use server';

/**
 * SabBigin activities — create / complete / delete server actions.
 *
 * These write the SAME `crm_activities` collection that the existing CRM
 * read APIs (`listCrmActivities`, `getCrmActivityPageKpis` in
 * `crm-activity.actions.ts`) query, so the unified SabBigin activities module
 * and the full CRM stay in sync.
 *
 * Collection shape compatibility:
 *   - The CRM reads filter on a lowercase `type` (`call|email|meeting|task|note`)
 *     and a `status` of `open|completed|overdue`, with the headline in `subject`.
 *   - The SabBigin `SabActivityRow` UI prefers a capitalized `type`
 *     (`Call|Email|Task|Meeting|Note`) and a `title`.
 * To satisfy both without a migration, every doc written here carries BOTH:
 *   `type` (lowercase, for CRM filters) + `typeLabel` (capitalized, for display),
 *   and `subject` === `title`. `status` is stored normalized to the CRM enum.
 *
 * Scoping: `userId` (the tenant) from `getSession`, matching the CRM reads.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';

const COL_ACTIVITIES = 'crm_activities';
const SABBIGIN_PATH = '/dashboard/sabbigin/activities';
const CRM_PATH = '/dashboard/crm/activity';

/** Capitalized activity types the SabBigin log modal exposes. */
export type SabbiginActivityType = 'Call' | 'Email' | 'Task' | 'Meeting' | 'Note';

const TYPE_LABELS: SabbiginActivityType[] = ['Call', 'Email', 'Task', 'Meeting', 'Note'];

/** Map a capitalized label to the lowercase `type` the CRM reads filter on. */
function typeToStorageKey(label: SabbiginActivityType): string {
  return label.toLowerCase();
}

/** Normalize a free-form status to the CRM `crm_activities` enum. */
function normalizeStatus(raw: string | undefined): 'open' | 'completed' | 'overdue' {
  const s = (raw ?? '').toLowerCase();
  if (s === 'completed' || s === 'done' || s === 'complete') return 'completed';
  if (s === 'overdue') return 'overdue';
  return 'open';
}

export interface LogSabbiginActivityInput {
  type: SabbiginActivityType;
  title: string;
  status?: string;
  /** 'inbound' | 'outbound' — meaningful for calls/emails. */
  direction?: string;
  /** ISO string or yyyy-mm-dd. */
  dueDate?: string;
  notes?: string;
  outcome?: string;
  contactId?: string;
  dealId?: string;
}

export interface LogSabbiginActivityResult {
  success: boolean;
  activityId?: string;
  error?: string;
}

/**
 * Log a Call / Email / Task / Meeting / Note into `crm_activities`.
 * Returns the new `_id` (hex) on success.
 */
export async function logSabbiginActivity(
  input: LogSabbiginActivityInput,
): Promise<LogSabbiginActivityResult> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied.' };

  const typeLabel: SabbiginActivityType = TYPE_LABELS.includes(input.type)
    ? input.type
    : 'Task';
  const title = (input.title ?? '').trim();
  if (!title) return { success: false, error: 'A title is required.' };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);
    const nowIso = new Date().toISOString();

    const status = normalizeStatus(input.status);

    const doc: Record<string, unknown> = {
      userId,
      // Dual type so CRM filters (lowercase) AND SabBigin display (label) work.
      type: typeToStorageKey(typeLabel),
      typeLabel,
      // Dual headline so CRM reads (`subject`) AND SabBigin reads (`title`) work.
      subject: title,
      title,
      status,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (input.direction) doc.direction = String(input.direction);
    if (input.notes && input.notes.trim()) doc.notes = input.notes.trim();
    if (input.outcome && input.outcome.trim()) doc.outcome = input.outcome.trim();

    if (input.dueDate) {
      const d = new Date(input.dueDate);
      if (!Number.isNaN(d.getTime())) doc.dueDate = d.toISOString();
    }
    if (status === 'completed') doc.completedAt = nowIso;

    if (input.contactId && ObjectId.isValid(input.contactId)) {
      doc.contactId = new ObjectId(input.contactId);
    } else if (input.contactId) {
      doc.contactId = input.contactId;
    }
    if (input.dealId && ObjectId.isValid(input.dealId)) {
      doc.dealId = new ObjectId(input.dealId);
    } else if (input.dealId) {
      doc.dealId = input.dealId;
    }

    const result = await db.collection(COL_ACTIVITIES).insertOne(doc as never);

    revalidatePath(SABBIGIN_PATH);
    revalidatePath(CRM_PATH);
    return { success: true, activityId: String(result.insertedId) };
  } catch (e) {
    console.error('[logSabbiginActivity] failed:', e);
    return { success: false, error: getErrorMessage(e) };
  }
}

/** Mark one activity completed (tenant-scoped). */
export async function completeSabbiginActivity(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied.' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid activity id.' };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);
    const nowIso = new Date().toISOString();
    const result = await db.collection(COL_ACTIVITIES).updateOne(
      { _id: new ObjectId(id), userId } as never,
      { $set: { status: 'completed', completedAt: nowIso, updatedAt: nowIso } },
    );
    if (result.matchedCount === 0) {
      return { success: false, error: 'Activity not found.' };
    }
    revalidatePath(SABBIGIN_PATH);
    revalidatePath(CRM_PATH);
    return { success: true };
  } catch (e) {
    console.error('[completeSabbiginActivity] failed:', e);
    return { success: false, error: getErrorMessage(e) };
  }
}

/** Delete one activity (tenant-scoped). */
export async function deleteSabbiginActivity(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied.' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid activity id.' };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);
    const result = await db.collection(COL_ACTIVITIES).deleteOne({
      _id: new ObjectId(id),
      userId,
    } as never);
    if (result.deletedCount === 0) {
      return { success: false, error: 'Activity not found.' };
    }
    revalidatePath(SABBIGIN_PATH);
    revalidatePath(CRM_PATH);
    return { success: true };
  } catch (e) {
    console.error('[deleteSabbiginActivity] failed:', e);
    return { success: false, error: getErrorMessage(e) };
  }
}
