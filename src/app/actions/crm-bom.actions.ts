'use server';

/**
 * CRM BOM server actions — §1D rebuild.
 *
 * Adds list / KPI / archive / duplicate / status-toggle / bulk surfaces
 * required by the §1D contract for the BOM list & detail pages while
 * preserving the existing saveBom + getCrmBomById callers.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';
import { crmBomApi } from '@/lib/rust-client/crm-bom';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

interface CrmBomComponent {
  itemId?: string;
  itemName: string;
  qty: number;
  unit: string;
  scrapPct: number;
  optional?: boolean;
  costPerUnit?: number;
}

interface CrmBomDoc {
  _id: ObjectId | string;
  userId: ObjectId | string;
  bomNo: string;
  finishedGoodName: string;
  finishedGoodId?: ObjectId | string;
  outputQty: number;
  unit: string;
  effectiveDate: Date | string;
  version: string;
  notes?: string;
  status?: string;
  active?: boolean;
  components: CrmBomComponent[];
  labourCost?: number;
  overheadCost?: number;
  totalCost?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface CrmBomKpis {
  active: number;
  finishedGoodsCovered: number;
  avgCost: number;
  versionsCount: number;
}

interface CrmBomListFilters {
  status?: string;
  finishedGoodId?: string;
  versionMin?: string;
  versionMax?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  activeOnly?: boolean;
  search?: string;
}

/* ─── Read helpers ──────────────────────────────────────────────── */

export async function getCrmBomById(
  bomId: string,
): Promise<WithId<CrmBomDoc> | null> {
  if (!bomId || !ObjectId.isValid(bomId)) return null;

  const session = await getSession();
  if (!session?.user) return null;

  if (useRustCrm()) {
    try {
      const doc = await crmBomApi.getById(bomId);
      return JSON.parse(JSON.stringify(doc));
    } catch (e) {
      console.error('[getCrmBomById] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'bom',
        op: 'get',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const bom = await db.collection<CrmBomDoc>('crm_boms').findOne({
      _id: new ObjectId(bomId),
      userId: new ObjectId(session.user._id),
    } as any);
    return bom ? JSON.parse(JSON.stringify(bom)) : null;
  } catch (e) {
    console.error('Failed to fetch CRM BOM:', e);
    recordRustFallback({ entity: 'bom', op: 'get' });
    return null;
  }
}

export async function getCrmBoms(
  filters: CrmBomListFilters = {},
): Promise<WithId<CrmBomDoc>[]> {
  const session = await getSession();
  if (!session?.user) return [];

  try {
    const { db } = await connectToDatabase();
    const query: Record<string, unknown> = {
      userId: new ObjectId(session.user._id),
    };
    if (filters.status && filters.status !== 'all') {
      query.status = filters.status;
    }
    if (filters.finishedGoodId && ObjectId.isValid(filters.finishedGoodId)) {
      query.finishedGoodId = new ObjectId(filters.finishedGoodId);
    }
    if (filters.activeOnly) {
      (query as any).$or = [{ active: true }, { status: 'active' }];
    }
    if (filters.effectiveFrom || filters.effectiveTo) {
      const dateRange: Record<string, Date> = {};
      if (filters.effectiveFrom) dateRange.$gte = new Date(filters.effectiveFrom);
      if (filters.effectiveTo) dateRange.$lte = new Date(filters.effectiveTo);
      query.effectiveDate = dateRange;
    }
    if (filters.search) {
      const re = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      (query as any).$or = [
        { bomNo: re },
        { finishedGoodName: re },
        { version: re },
      ];
    }

    const docs = await db
      .collection<CrmBomDoc>('crm_boms')
      .find(query as any)
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    let list = JSON.parse(JSON.stringify(docs)) as WithId<CrmBomDoc>[];

    // Version range is a string field with semver-ish values; do a
    // client-side numeric-aware compare for `versionMin`/`versionMax`.
    if (filters.versionMin || filters.versionMax) {
      const cmp = (a: string, b: string) => {
        const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
        const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
        const len = Math.max(pa.length, pb.length);
        for (let i = 0; i < len; i++) {
          const da = pa[i] ?? 0;
          const db_ = pb[i] ?? 0;
          if (da !== db_) return da - db_;
        }
        return 0;
      };
      list = list.filter((b) => {
        const v = String((b as any).version ?? '');
        if (filters.versionMin && cmp(v, filters.versionMin) < 0) return false;
        if (filters.versionMax && cmp(v, filters.versionMax) > 0) return false;
        return true;
      });
    }

    return list;
  } catch (e) {
    console.error('Failed to fetch CRM BOMs:', e);
    recordRustFallback({ entity: 'bom', op: 'list' });
    return [];
  }
}

export async function getCrmBomKpis(): Promise<CrmBomKpis> {
  const empty: CrmBomKpis = {
    active: 0,
    finishedGoodsCovered: 0,
    avgCost: 0,
    versionsCount: 0,
  };
  const session = await getSession();
  if (!session?.user) return empty;
  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);
    const docs = await db
      .collection<CrmBomDoc>('crm_boms')
      .find({ userId: userObjectId } as any)
      .toArray();

    const active = docs.filter(
      (d) => (d as any).active === true || (d as any).status === 'active',
    ).length;
    const fg = new Set<string>();
    const versions = new Set<string>();
    let costSum = 0;
    let costN = 0;
    for (const d of docs) {
      const fgKey =
        (d as any).finishedGoodId?.toString?.() ||
        (d as any).finishedGoodName ||
        '';
      if (fgKey) fg.add(fgKey);
      if ((d as any).version) versions.add(String((d as any).version));
      const total = typeof (d as any).totalCost === 'number' ? (d as any).totalCost : 0;
      if (total > 0) {
        costSum += total;
        costN += 1;
      }
    }
    return {
      active,
      finishedGoodsCovered: fg.size,
      avgCost: costN > 0 ? Math.round(costSum / costN) : 0,
      versionsCount: versions.size,
    };
  } catch (e) {
    console.error('Failed to compute BOM KPIs:', e);
    recordRustFallback({ entity: 'bom', op: 'other' });
    return empty;
  }
}

/* ─── Write surfaces ────────────────────────────────────────────── */

function computeBomTotalCost(
  components: CrmBomComponent[],
  labour: number,
  overhead: number,
): number {
  let mat = 0;
  for (const c of components) {
    const qty = Number.isFinite(c.qty) ? c.qty : 0;
    const cost = Number.isFinite(c.costPerUnit ?? 0) ? c.costPerUnit ?? 0 : 0;
    const scrapMul = 1 + ((Number.isFinite(c.scrapPct) ? c.scrapPct : 0) / 100);
    mat += qty * cost * scrapMul;
  }
  return Math.round((mat + labour + overhead) * 100) / 100;
}

export async function saveBom(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  try {
    const bomId = (formData.get('bomId') as string | null)?.trim() || '';
    const isEditing = !!bomId && ObjectId.isValid(bomId);

    const guard = await requirePermission('crm_bom', isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    const bomNoRaw = (formData.get('bomNo') as string | null)?.trim() || '';
    const finishedGoodName = (formData.get('finishedGoodName') as string | null)?.trim() || '';
    if (!finishedGoodName) return { error: 'Finished Good Name is required.' };

    const finishedGoodId = (formData.get('finishedGoodId') as string | null)?.trim() || '';
    const outputQtyRaw = formData.get('outputQty');
    const outputQty = outputQtyRaw ? parseFloat(outputQtyRaw as string) : 1;
    const unit = (formData.get('unit') as string | null)?.trim() || '';
    const effectiveDateRaw = (formData.get('effectiveDate') as string | null)?.trim() || '';
    const version = (formData.get('version') as string | null)?.trim() || '1.0';
    const notes = (formData.get('notes') as string | null)?.trim() || '';
    const statusRaw = (formData.get('status') as string | null)?.trim() || '';
    const status = statusRaw || 'active';
    const componentsRaw = (formData.get('components') as string | null) || '[]';
    const labourCost = parseFloat((formData.get('labourCost') as string | null) || '0') || 0;
    const overheadCost = parseFloat((formData.get('overheadCost') as string | null) || '0') || 0;

    let parsedComponents: CrmBomComponent[] = [];
    try {
      parsedComponents = JSON.parse(componentsRaw);
    } catch {
      parsedComponents = [];
    }

    const totalCost = computeBomTotalCost(parsedComponents, labourCost, overheadCost);

    const bomNo = bomNoRaw || `BOM-${Date.now().toString().slice(-6)}`;

    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);

    if (isEditing) {
      const update = {
        bomNo,
        finishedGoodName,
        finishedGoodId:
          finishedGoodId && ObjectId.isValid(finishedGoodId)
            ? new ObjectId(finishedGoodId)
            : undefined,
        outputQty: isNaN(outputQty) ? 1 : outputQty,
        unit,
        effectiveDate: effectiveDateRaw ? new Date(effectiveDateRaw) : new Date(),
        version,
        components: parsedComponents,
        labourCost,
        overheadCost,
        totalCost,
        status,
        active: status === 'active',
        notes,
        updatedAt: new Date(),
      };
      await db.collection('crm_boms').updateOne(
        { _id: new ObjectId(bomId), userId: userObjectId },
        { $set: update },
      );
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        action: 'update',
        entityKind: 'bom',
        entityId: bomId,
        reason: `Updated BOM ${bomNo}`,
      });
      revalidatePath('/dashboard/crm/inventory/bom');
      revalidatePath(`/dashboard/crm/inventory/bom/${bomId}`);
      return { message: 'BOM updated.', id: bomId };
    }

    const result = await db.collection('crm_boms').insertOne({
      userId: userObjectId,
      bomNo,
      finishedGoodName,
      finishedGoodId:
        finishedGoodId && ObjectId.isValid(finishedGoodId)
          ? new ObjectId(finishedGoodId)
          : undefined,
      outputQty: isNaN(outputQty) ? 1 : outputQty,
      unit,
      effectiveDate: effectiveDateRaw ? new Date(effectiveDateRaw) : new Date(),
      version,
      components: parsedComponents,
      labourCost,
      overheadCost,
      totalCost,
      status,
      active: status === 'active',
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      action: 'create',
      entityKind: 'bom',
      entityId: result.insertedId.toString(),
      reason: `Created BOM ${bomNo} for ${finishedGoodName}`,
    });

    revalidatePath('/dashboard/crm/inventory/bom');
    return { message: 'BOM created.', id: result.insertedId.toString() };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('saveBom error:', msg);
    recordRustFallback({ entity: 'bom', op: 'create' });
    return { error: `Failed to save BOM: ${msg}` };
  }
}

/* ─── Status / archive / duplicate ─────────────────────────────── */

export async function setBomStatus(
  bomId: string,
  status: 'active' | 'inactive' | 'archived' | 'draft',
): Promise<{ success: boolean; error?: string }> {
  if (!ObjectId.isValid(bomId)) return { success: false, error: 'Invalid BOM id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  const guard = await requirePermission('crm_bom', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    const { db } = await connectToDatabase();
    await db.collection('crm_boms').updateOne(
      { _id: new ObjectId(bomId), userId: new ObjectId(session.user._id as string) } as any,
      {
        $set: {
          status,
          active: status === 'active',
          updatedAt: new Date(),
        },
      },
    );
    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      action: status === 'archived' ? 'archive' : 'status_change',
      entityKind: 'bom',
      entityId: bomId,
      reason: `BOM status → ${status}`,
    });
    revalidatePath('/dashboard/crm/inventory/bom');
    revalidatePath(`/dashboard/crm/inventory/bom/${bomId}`);
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    recordRustFallback({ entity: 'bom', op: 'update' });
    return { success: false, error: msg };
  }
}

export async function duplicateBom(
  bomId: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!ObjectId.isValid(bomId)) return { success: false, error: 'Invalid BOM id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  try {
    const { db } = await connectToDatabase();
    const src = await db.collection<CrmBomDoc>('crm_boms').findOne({
      _id: new ObjectId(bomId),
      userId: new ObjectId(session.user._id as string),
    } as any);
    if (!src) return { success: false, error: 'BOM not found.' };
    const { _id, createdAt, updatedAt, ...rest } = src as any;
    const newDoc = {
      ...rest,
      bomNo: `${rest.bomNo || 'BOM'}-COPY-${Date.now().toString().slice(-4)}`,
      version: rest.version ? `${rest.version}-copy` : '1.0-copy',
      status: 'draft',
      active: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    void _id;
    void createdAt;
    void updatedAt;
    const result = await db.collection('crm_boms').insertOne(newDoc);
    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      action: 'create',
      entityKind: 'bom',
      entityId: result.insertedId.toString(),
      reason: `Duplicated from ${bomId}`,
    });
    revalidatePath('/dashboard/crm/inventory/bom');
    return { success: true, id: result.insertedId.toString() };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    recordRustFallback({ entity: 'bom', op: 'create' });
    return { success: false, error: msg };
  }
}

export async function deleteBom(bomId: string): Promise<{ success: boolean; error?: string }> {
  if (!ObjectId.isValid(bomId)) return { success: false, error: 'Invalid BOM id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  const guard = await requirePermission('crm_bom', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    const { db } = await connectToDatabase();
    await db.collection('crm_boms').deleteOne({
      _id: new ObjectId(bomId),
      userId: new ObjectId(session.user._id as string),
    } as any);
    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      action: 'delete',
      entityKind: 'bom',
      entityId: bomId,
    });
    revalidatePath('/dashboard/crm/inventory/bom');
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    recordRustFallback({ entity: 'bom', op: 'delete' });
    return { success: false, error: msg };
  }
}

export async function bulkBomAction(
  ids: string[],
  op: 'archive' | 'delete' | 'activate' | 'deactivate',
): Promise<{ success: boolean; processed: number; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, processed: 0, error: 'Access denied.' };
  const guard = await requirePermission('crm_bom', op === 'delete' ? 'delete' : 'edit');
  if (!guard.ok) return { success: false, processed: 0, error: guard.error };
  const validIds = ids.filter((id) => ObjectId.isValid(id));
  if (validIds.length === 0) return { success: false, processed: 0, error: 'No valid ids.' };

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);
    const objIds = validIds.map((id) => new ObjectId(id));
    let processed = 0;

    if (op === 'delete') {
      const r = await db
        .collection('crm_boms')
        .deleteMany({ _id: { $in: objIds }, userId: userObjectId } as any);
      processed = r.deletedCount ?? 0;
    } else {
      const setStatus =
        op === 'archive' ? 'archived' : op === 'activate' ? 'active' : 'inactive';
      const r = await db.collection('crm_boms').updateMany(
        { _id: { $in: objIds }, userId: userObjectId } as any,
        {
          $set: {
            status: setStatus,
            active: setStatus === 'active',
            updatedAt: new Date(),
          },
        },
      );
      processed = r.modifiedCount ?? 0;
    }

    for (const id of validIds) {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        action: op === 'delete' ? 'delete' : op === 'archive' ? 'archive' : 'status_change',
        entityKind: 'bom',
        entityId: id,
        reason: `Bulk ${op}`,
      });
    }
    revalidatePath('/dashboard/crm/inventory/bom');
    return { success: true, processed };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    recordRustFallback({ entity: 'bom', op: 'other' });
    return { success: false, processed: 0, error: msg };
  }
}

/** Sibling BOM versions for the same finished good (excluding the current BOM). */
export async function getBomVersionsForFinishedGood(
  finishedGoodId: string | undefined,
  excludeBomId: string,
): Promise<{ _id: string; bomNo: string; version: string; status: string; active?: boolean }[]> {
  if (!finishedGoodId || !ObjectId.isValid(finishedGoodId)) return [];
  const session = await getSession();
  if (!session?.user) return [];
  try {
    const { db } = await connectToDatabase();
    const docs = await db
      .collection('crm_boms')
      .find({
        userId: new ObjectId(session.user._id as string),
        finishedGoodId: new ObjectId(finishedGoodId),
        ...(ObjectId.isValid(excludeBomId)
          ? { _id: { $ne: new ObjectId(excludeBomId) } }
          : {}),
      } as any)
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    return docs.map((d: any) => ({
      _id: d._id.toString(),
      bomNo: d.bomNo || '',
      version: d.version || '',
      status: d.status || 'draft',
      active: d.active,
    }));
  } catch (e) {
    console.error('Failed to load BOM versions:', e);
    recordRustFallback({ entity: 'bom', op: 'list' });
    return [];
  }
}

/** Fetch production orders that reference a given BOM (by `bomRef` or `bomId`). */
export async function getProductionOrdersForBom(
  bomId: string,
): Promise<{ _id: string; orderNo: string; status: string; plannedQty: number; createdAt?: string }[]> {
  if (!ObjectId.isValid(bomId)) return [];
  const session = await getSession();
  if (!session?.user) return [];
  try {
    const { db } = await connectToDatabase();
    const docs = await db
      .collection('crm_production_orders')
      .find({
        userId: new ObjectId(session.user._id as string),
        $or: [{ bomRef: bomId }, { bomId: new ObjectId(bomId) }],
      } as any)
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    return docs.map((d: any) => ({
      _id: d._id.toString(),
      orderNo: d.orderNo || '',
      status: d.status || 'draft',
      plannedQty: d.plannedQty ?? 0,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : undefined,
    }));
  } catch (e) {
    console.error('Failed to load related production orders:', e);
    recordRustFallback({ entity: 'bom', op: 'list' });
    return [];
  }
}
