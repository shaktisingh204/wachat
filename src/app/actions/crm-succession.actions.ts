'use server';

/**
 * CRM Succession Plan server actions.
 *
 * Tenant-scoped reads/writes against the `crm_succession_plans` Mongo
 * collection. Soft-deletes via the `archived` flag.
 *
 * Schema (per `crm_function_plan.md` §10):
 *   - role / position (string, required)
 *   - incumbentEmployeeId (string, optional)
 *   - candidates: array of { employeeId, name, readiness }
 *   - readiness on plan-level (overall): 'ready' | '12mo' | '24mo' | 'long-term'
 *   - notes (string)
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { writeAuditEntry } from '@/lib/audit-log';
import { crmSuccessionApi } from '@/lib/rust-client/crm-succession';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

export type SuccessionReadiness = 'ready' | '12mo' | '24mo' | 'long-term';

export interface SuccessionCandidate {
  employeeId?: string;
  name: string;
  readiness?: SuccessionReadiness;
  notes?: string;
}

export interface CrmSuccessionDoc {
  _id?: ObjectId;
  userId: ObjectId;
  role: string;
  incumbentEmployeeId?: string;
  incumbentName?: string;
  candidates: SuccessionCandidate[];
  readiness: SuccessionReadiness;
  notes?: string;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function revalidateSurfaces(id?: string): void {
  revalidatePath('/dashboard/hrm/hr/succession');
  if (id) revalidatePath(`/dashboard/hrm/hr/succession/${id}`);
}

/* ─── getCrmSuccessionPlans ───────────────────────────────────────────── */

export async function getCrmSuccessionPlans(
  status: 'active' | 'archived' | 'all' = 'active',
): Promise<WithId<CrmSuccessionDoc>[]> {
  const session = await getSession();
  if (!session?.user) return [];

  try {
    const { db } = await connectToDatabase();
    const filter: Record<string, unknown> = {
      userId: new ObjectId(session.user._id as string),
    };
    if (status === 'active') filter.archived = { $ne: true };
    else if (status === 'archived') filter.archived = true;

    const docs = await db
      .collection<CrmSuccessionDoc>('crm_succession_plans')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();
    return JSON.parse(JSON.stringify(docs)) as WithId<CrmSuccessionDoc>[];
  } catch (e) {
    console.error('[getCrmSuccessionPlans]', e);
    return [];
  }
}

/* ─── getCrmSuccessionPlanById ────────────────────────────────────────── */

export async function getCrmSuccessionPlanById(
  id: string,
): Promise<WithId<CrmSuccessionDoc> | null> {
  const session = await getSession();
  if (!session?.user) return null;
  if (!id || !ObjectId.isValid(id)) return null;

  if (useRustCrm()) {
    try {
      const doc = await crmSuccessionApi.getById(id);
      return JSON.parse(JSON.stringify(doc)) as WithId<CrmSuccessionDoc>;
    } catch (e) {
      console.error('[getCrmSuccessionPlanById] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'succession_plan',
        op: 'get',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const doc = await db
      .collection<CrmSuccessionDoc>('crm_succession_plans')
      .findOne({
        _id: new ObjectId(id),
        userId: new ObjectId(session.user._id as string),
      });
    return doc
      ? (JSON.parse(JSON.stringify(doc)) as WithId<CrmSuccessionDoc>)
      : null;
  } catch (e) {
    console.error('[getCrmSuccessionPlanById]', e);
    return null;
  }
}

/* ─── saveCrmSuccessionPlan ───────────────────────────────────────────── */

function parseCandidatesJson(raw: string | null): SuccessionCandidate[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((c) => {
        if (!c || typeof c !== 'object') return null;
        const rec = c as Record<string, unknown>;
        const name = typeof rec.name === 'string' ? rec.name.trim() : '';
        if (!name) return null;
        return {
          name,
          employeeId:
            typeof rec.employeeId === 'string' ? rec.employeeId : undefined,
          readiness:
            typeof rec.readiness === 'string'
              ? (rec.readiness as SuccessionReadiness)
              : undefined,
          notes: typeof rec.notes === 'string' ? rec.notes : undefined,
        } as SuccessionCandidate;
      })
      .filter((x): x is SuccessionCandidate => !!x);
  } catch {
    return [];
  }
}

export async function saveCrmSuccessionPlan(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const idRaw = (formData.get('_id') as string | null) || '';
  const role = ((formData.get('role') as string | null) || '').trim();
  if (!role) return { error: 'Role is required.' };

  const incumbentEmployeeId =
    ((formData.get('incumbentEmployeeId') as string | null) || '').trim() ||
    undefined;
  const incumbentName =
    ((formData.get('incumbentName') as string | null) || '').trim() || undefined;
  const readiness = (((formData.get('readiness') as string | null) ||
    '24mo') as SuccessionReadiness);
  const notes =
    ((formData.get('notes') as string | null) || '').trim() || undefined;

  const candidates = parseCandidatesJson(
    (formData.get('candidates') as string | null) || '[]',
  );

  const update: Partial<CrmSuccessionDoc> = {
    role,
    incumbentEmployeeId,
    incumbentName,
    candidates,
    readiness,
    notes,
    updatedAt: new Date(),
  };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);

    if (idRaw && ObjectId.isValid(idRaw)) {
      const res = await db
        .collection<CrmSuccessionDoc>('crm_succession_plans')
        .updateOne(
          { _id: new ObjectId(idRaw), userId },
          { $set: update },
        );
      if (res.matchedCount === 0) {
        return { error: 'Succession plan not found or access denied.' };
      }
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'update',
        entityKind: 'succession',
        entityId: idRaw,
      });
      revalidateSurfaces(idRaw);
      return { message: 'Succession plan updated.', id: idRaw };
    }

    const doc: CrmSuccessionDoc = {
      userId,
      role,
      candidates,
      readiness,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...update,
    };

    const result = await db
      .collection<CrmSuccessionDoc>('crm_succession_plans')
      .insertOne(doc);

    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action: 'create',
      entityKind: 'succession',
      entityId: String(result.insertedId),
    });

    revalidateSurfaces();
    return {
      message: 'Succession plan created.',
      id: result.insertedId.toString(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[saveCrmSuccessionPlan]', e);
    return { error: msg };
  }
}

/* ─── deleteCrmSuccessionPlan ─────────────────────────────────────────── */

/* ─── Bulk ────────────────────────────────────────────────────────────── */

export async function bulkDeleteCrmSuccessionPlans(
  ids: string[],
): Promise<{ succeeded: number; failed: number }> {
  const session = await getSession();
  if (!session?.user) return { succeeded: 0, failed: ids.length };

  let succeeded = 0;
  let failed = 0;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);

    for (const id of ids) {
      if (!ObjectId.isValid(id)) { failed++; continue; }
      try {
        const res = await db.collection('crm_succession_plans').updateOne(
          { _id: new ObjectId(id), userId },
          { $set: { archived: true, updatedAt: new Date() } },
        );
        if (res.matchedCount > 0) succeeded++;
        else failed++;
      } catch {
        failed++;
      }
    }
  } catch {
    return { succeeded: 0, failed: ids.length };
  }

  if (succeeded > 0) revalidateSurfaces();
  return { succeeded, failed };
}

export async function deleteCrmSuccessionPlan(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  if (!id || !ObjectId.isValid(id)) {
    return { success: false, error: 'Invalid id.' };
  }

  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('crm_succession_plans').updateOne(
      {
        _id: new ObjectId(id),
        userId: new ObjectId(session.user._id as string),
      },
      { $set: { archived: true, updatedAt: new Date() } },
    );
    if (res.matchedCount === 0) {
      return { success: false, error: 'Not found.' };
    }
    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action: 'archive',
      entityKind: 'succession',
      entityId: id,
    });
    revalidateSurfaces(id);
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: msg };
  }
}
