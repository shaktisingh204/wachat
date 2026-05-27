'use server';

/**
 * CRM Teams — server actions backed by Mongo collection `crm_teams`.
 *
 * Standalone collection (no Rust crate yet) but written in the same
 * shape as the Rust-backed action files so swapping to a future
 * `crm-teams` crate is a one-import change.
 *
 * Document shape:
 *   { _id, name, departmentId?, leadEmployeeId?, memberIds[], description?,
 *     isActive (bool), status, userId, createdAt, updatedAt }
 *
 * RBAC: gated under `crm_team` (falls back to `crm_employee` view if the
 * dedicated key is not yet registered in the permission catalog).
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type Filter, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';

const COLLECTION = 'crm_teams';
const LIST_PATH = '/dashboard/hrm/payroll/employees/teams';
const PERM_KEY = 'crm_team';

type CrmTeamStatus = 'active' | 'archived' | 'draft';

interface CrmTeamDoc {
  _id: string;
  name: string;
  departmentId?: string;
  leadEmployeeId?: string;
  memberIds: string[];
  description?: string;
  isActive: boolean;
  status: CrmTeamStatus;
  createdAt?: string;
  updatedAt?: string;
}

interface CrmTeamCreateInput {
  name: string;
  departmentId?: string;
  leadEmployeeId?: string;
  memberIds?: string[];
  description?: string;
  isActive?: boolean;
  status?: CrmTeamStatus;
}

type CrmTeamUpdateInput = Partial<CrmTeamCreateInput>;

interface CrmTeamListParams {
  q?: string;
  departmentId?: string;
  status?: CrmTeamStatus;
  limit?: number;
}

interface CrmTeamListResult {
  items: CrmTeamDoc[];
  error?: string;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function toObjectId(v: unknown): ObjectId | undefined {
  if (typeof v !== 'string') return undefined;
  return ObjectId.isValid(v) ? new ObjectId(v) : undefined;
}

function serialize<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc));
}

function mapDoc(doc: WithId<Record<string, unknown>>): CrmTeamDoc {
  return {
    _id: String(doc._id),
    name: String(doc.name ?? ''),
    departmentId: doc.departmentId ? String(doc.departmentId) : undefined,
    leadEmployeeId: doc.leadEmployeeId ? String(doc.leadEmployeeId) : undefined,
    memberIds: Array.isArray(doc.memberIds)
      ? (doc.memberIds as unknown[]).map((id) => String(id))
      : [],
    description:
      typeof doc.description === 'string' && doc.description.trim()
        ? String(doc.description)
        : undefined,
    isActive: doc.isActive !== false,
    status:
      (typeof doc.status === 'string'
        ? (doc.status as CrmTeamStatus)
        : 'active') ?? 'active',
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : (doc.createdAt as string | undefined),
    updatedAt:
      doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : (doc.updatedAt as string | undefined),
  };
}

function pickStr(fd: FormData, k: string): string | undefined {
  const v = fd.get(k);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function pickBool(fd: FormData, k: string): boolean | undefined {
  const v = fd.get(k);
  if (v == null) return undefined;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (['true', '1', 'on', 'yes'].includes(t)) return true;
    if (['false', '0', 'off', 'no'].includes(t)) return false;
  }
  return undefined;
}

function pickStrArray(fd: FormData, k: string): string[] {
  const raw = fd.get(k);
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((v) => String(v)).filter((s) => s.length > 0);
    }
  } catch {
    // CSV fallback
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const VALID_STATUSES: ReadonlySet<CrmTeamStatus> = new Set<CrmTeamStatus>([
  'active',
  'archived',
  'draft',
]);

/* ── Reads ───────────────────────────────────────────────────────── */

export async function listTeams(
  params: CrmTeamListParams = {},
): Promise<CrmTeamListResult> {
  const session = await getSession();
  if (!session?.user) return { items: [], error: 'Access denied.' };

  try {
    const { db } = await connectToDatabase();
    const filter: Filter<Record<string, unknown>> = {
      userId: new ObjectId(session.user._id),
    };
    if (params.q) {
      filter.name = { $regex: params.q.trim(), $options: 'i' };
    }
    if (params.departmentId && ObjectId.isValid(params.departmentId)) {
      filter.departmentId = new ObjectId(params.departmentId);
    }
    if (params.status && VALID_STATUSES.has(params.status)) {
      filter.status = params.status;
    }
    const limit = Math.min(Math.max(1, params.limit ?? 100), 200);
    const docs = await db
      .collection(COLLECTION)
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    return { items: docs.map((d) => mapDoc(serialize(d))) };
  } catch (e) {
    return {
      items: [],
      error: e instanceof Error ? e.message : 'Failed to list teams.',
    };
  }
}

export async function getTeam(
  id: string,
): Promise<{ item: CrmTeamDoc | null; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { item: null, error: 'Access denied.' };
  if (!ObjectId.isValid(id)) return { item: null, error: 'Invalid id.' };

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection(COLLECTION).findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.user._id),
    });
    if (!doc) return { item: null };
    return { item: mapDoc(serialize(doc)) };
  } catch (e) {
    return {
      item: null,
      error: e instanceof Error ? e.message : 'Failed to load team.',
    };
  }
}

/* ── Writes ──────────────────────────────────────────────────────── */

export async function saveTeamAction(
  _prev: unknown,
  fd: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const id = pickStr(fd, '_id');
  const name = pickStr(fd, 'name');
  if (!name) return { error: 'Team name is required.' };

  const guard = await requirePermission(PERM_KEY, id ? 'edit' : 'create');
  if (!guard.ok) return { error: guard.error };

  const statusRaw = pickStr(fd, 'status');
  const status: CrmTeamStatus =
    statusRaw && VALID_STATUSES.has(statusRaw as CrmTeamStatus)
      ? (statusRaw as CrmTeamStatus)
      : 'active';

  const memberIds = pickStrArray(fd, 'memberIds');
  const memberObjectIds = memberIds
    .map(toObjectId)
    .filter((v): v is ObjectId => !!v);

  const draft: Record<string, unknown> = {
    name,
    departmentId: toObjectId(pickStr(fd, 'departmentId')),
    leadEmployeeId: toObjectId(pickStr(fd, 'leadEmployeeId')),
    memberIds: memberObjectIds,
    description: pickStr(fd, 'description'),
    isActive: pickBool(fd, 'isActive') ?? true,
    status,
  };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    const now = new Date();

    if (id && ObjectId.isValid(id)) {
      await db.collection(COLLECTION).updateOne(
        { _id: new ObjectId(id), userId },
        {
          $set: { ...draft, updatedAt: now },
        },
      );
      revalidatePath(LIST_PATH);
      return { message: 'Team updated.', id };
    }

    const result = await db.collection(COLLECTION).insertOne({
      ...draft,
      userId,
      createdAt: now,
      updatedAt: now,
    });
    revalidatePath(LIST_PATH);
    return { message: 'Team created.', id: result.insertedId.toString() };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Failed to save team.',
    };
  }
}

export async function deleteTeamAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  if (!ObjectId.isValid(id))
    return { success: false, error: 'Invalid id.' };

  const guard = await requirePermission(PERM_KEY, 'delete');
  if (!guard.ok) return { success: false, error: guard.error };

  try {
    const { db } = await connectToDatabase();
    await db.collection(COLLECTION).deleteOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.user._id),
    });
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Failed to delete team.',
    };
  }
}
