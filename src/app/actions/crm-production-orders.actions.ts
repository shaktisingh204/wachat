'use server';

/**
 * CRM Production Orders server actions — §1D rebuild.
 *
 * Adds list / KPI / status-transition / archive / bulk surfaces and a
 * BOM-prefill helper alongside the existing save / get / update-yield
 * functions.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, Filter, Document } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';
import { crmProductionOrdersApi } from '@/lib/rust-client/crm-production-orders';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { CrmBomComponent } from '@/app/actions/crm-bom.actions.types';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

interface CrmProductionOrderDoc {
  _id: string;
  userId: string;
  orderNo: string;
  bomRef?: string;
  bomId?: string;
  finishedGoodId?: string;
  finishedGoodName: string;
  plannedQty: number;
  actualYield?: number;
  scrap?: number;
  unit?: string;
  plannedStart?: string;
  plannedEnd?: string;
  machineId?: string;
  machineOperator?: string;
  machineOperatorId?: string;
  notes?: string;
  status: string;
  components?: CrmBomComponent[];
  componentsConsumed?: { itemName: string; planned: number; actual: number; unit?: string }[];
  labourCost?: number;
  overheadCost?: number;
  materialCost?: number;
  totalCost?: number;
  downtimeReasons?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface CrmProductionOrderKpis {
  open: number;
  inProgress: number;
  completed: number;
  scrapRate: number;
  avgYieldPct: number;
}

interface CrmProductionOrderFilters {
  status?: string;
  bom?: string;
  dateFrom?: string;
  dateTo?: string;
  machineId?: string;
  operatorId?: string;
  yieldBucket?: 'low' | 'mid' | 'high';
  search?: string;
}

/* ─── Read helpers ──────────────────────────────────────────────── */

export async function getProductionOrderById(
  orderId: string,
): Promise<CrmProductionOrderDoc | null> {
  if (!ObjectId.isValid(orderId)) return null;
  const session = await getSession();
  if (!session?.user?._id) return null;

  if (useRustCrm()) {
    try {
      const doc = await crmProductionOrdersApi.getById(orderId);
      return JSON.parse(JSON.stringify(doc));
    } catch (e) {
      console.error('[getProductionOrderById] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'production_order',
        op: 'get',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('crm_production_orders').findOne({
      _id: new ObjectId(orderId),
      userId: new ObjectId(session.user._id as string),
    } as Filter<Document>, { maxTimeMS: 5000 });
    return doc ? JSON.parse(JSON.stringify(doc)) : null;
  } catch (e) {
    console.error('Failed to load production order:', e);
    recordRustFallback({ entity: 'production_order', op: 'get' });
    return null;
  }
}

export async function getProductionOrders(
  filters: CrmProductionOrderFilters = {},
): Promise<CrmProductionOrderDoc[]> {
  const session = await getSession();
  if (!session?.user) return [];
  try {
    const { db } = await connectToDatabase();
    const query: Record<string, unknown> = {
      userId: new ObjectId(session.user._id as string),
    };
    if (filters.status && filters.status !== 'all') {
      query.status = filters.status;
    }
    if (filters.bom) {
      if (ObjectId.isValid(filters.bom)) {
        (query as any).$or = [
          { bomRef: filters.bom },
          { bomId: new ObjectId(filters.bom) },
        ];
      } else {
        (query as any).bomRef = { $regex: filters.bom, $options: 'i' };
      }
    }
    if (filters.machineId) query.machineId = filters.machineId;
    if (filters.operatorId) {
      if (ObjectId.isValid(filters.operatorId)) {
        query.machineOperatorId = new ObjectId(filters.operatorId);
      } else {
        query.machineOperator = filters.operatorId;
      }
    }
    if (filters.dateFrom || filters.dateTo) {
      const r: Record<string, Date> = {};
      if (filters.dateFrom) r.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) r.$lte = new Date(filters.dateTo);
      query.plannedStart = r;
    }
    if (filters.search) {
      const re = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      (query as any).$or = [
        { orderNo: re },
        { finishedGoodName: re },
        { bomRef: re },
      ];
    }
    const filterQuery = query as Filter<Document>;
    const docs = await db
      .collection('crm_production_orders')
      .find(filterQuery)
      .maxTimeMS(5000)
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();
    let list = JSON.parse(JSON.stringify(docs)) as CrmProductionOrderDoc[];
    if (filters.yieldBucket) {
      list = list.filter((o) => {
        const pct = o.plannedQty > 0 ? (o.actualYield ?? 0) / o.plannedQty : 0;
        if (filters.yieldBucket === 'low') return pct < 0.6;
        if (filters.yieldBucket === 'mid') return pct >= 0.6 && pct < 0.9;
        return pct >= 0.9;
      });
    }
    return list;
  } catch (e) {
    console.error('Failed to load production orders:', e);
    recordRustFallback({ entity: 'production_order', op: 'list' });
    return [];
  }
}

export async function getProductionOrderKpis(): Promise<CrmProductionOrderKpis> {
  const empty: CrmProductionOrderKpis = {
    open: 0,
    inProgress: 0,
    completed: 0,
    scrapRate: 0,
    avgYieldPct: 0,
  };
  const session = await getSession();
  if (!session?.user) return empty;
  try {
    const { db } = await connectToDatabase();
    const docs = await db
      .collection('crm_production_orders')
      .find({ userId: new ObjectId(session.user._id as string) } as Filter<Document>)
      .maxTimeMS(5000)
      .toArray();
    let open = 0;
    let inProgress = 0;
    let completed = 0;
    let yieldSum = 0;
    let yieldN = 0;
    let scrapSum = 0;
    let scrapBaseSum = 0;
    for (const d of docs as any[]) {
      const status = String(d.status || '').toLowerCase();
      if (status === 'completed' || status === 'closed') {
        completed += 1;
        const planned = d.plannedQty ?? 0;
        const actual = d.actualYield ?? 0;
        const scrap = d.scrap ?? Math.max(planned - actual, 0);
        if (planned > 0) {
          yieldSum += actual / planned;
          yieldN += 1;
          scrapSum += scrap;
          scrapBaseSum += planned;
        }
      } else if (status === 'in_progress' || status === 'in progress' || status === 'released' || status === 'started') {
        inProgress += 1;
      } else {
        open += 1;
      }
    }
    return {
      open,
      inProgress,
      completed,
      scrapRate: scrapBaseSum > 0 ? Math.round((scrapSum / scrapBaseSum) * 1000) / 10 : 0,
      avgYieldPct: yieldN > 0 ? Math.round((yieldSum / yieldN) * 1000) / 10 : 0,
    };
  } catch (e) {
    console.error('Failed to compute production-order KPIs:', e);
    recordRustFallback({ entity: 'production_order', op: 'other' });
    return empty;
  }
}

/* ─── BOM prefill helper ────────────────────────────────────────── */

export async function getBomPrefillForProductionOrder(
  bomId: string,
): Promise<{
  bomId: string;
  bomNo?: string;
  finishedGoodId?: string;
  finishedGoodName?: string;
  outputQty?: number;
  unit?: string;
  components: CrmBomComponent[];
  labourCost?: number;
  overheadCost?: number;
} | null> {
  if (!ObjectId.isValid(bomId)) return null;
  const session = await getSession();
  if (!session?.user) return null;
  try {
    const { db } = await connectToDatabase();
    const bom = await db.collection('crm_boms').findOne({
      _id: new ObjectId(bomId),
      userId: new ObjectId(session.user._id as string),
    } as Filter<Document>, { maxTimeMS: 5000 });
    if (!bom) return null;
    const b = bom as Document;
    return {
      bomId,
      bomNo: b.bomNo,
      finishedGoodId: b.finishedGoodId?.toString?.(),
      finishedGoodName: b.finishedGoodName,
      outputQty: b.outputQty,
      unit: b.unit,
      components: Array.isArray(b.components) ? b.components : [],
      labourCost: b.labourCost,
      overheadCost: b.overheadCost,
    };
  } catch (e) {
    console.error('BOM prefill failed:', e);
    recordRustFallback({ entity: 'production_order', op: 'other' });
    return null;
  }
}

/* ─── Save / status / yield ─────────────────────────────────────── */

export async function saveProductionOrder(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  try {
    const orderId = (formData.get('orderId') as string | null)?.trim() || '';
    const isEditing = !!orderId && ObjectId.isValid(orderId);

    const guard = await requirePermission('crm_production_order', isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    const orderNoRaw = (formData.get('orderNo') as string | null)?.trim() || '';
    const finishedGoodName = (formData.get('finishedGoodName') as string | null)?.trim() || '';
    if (!finishedGoodName) return { error: 'Finished Good Name is required.' };
    const finishedGoodId = (formData.get('finishedGoodId') as string | null)?.trim() || '';

    const bomRef = (formData.get('bomRef') as string | null)?.trim() || '';
    const bomId = (formData.get('bomId') as string | null)?.trim() || '';
    const plannedQtyRaw = formData.get('plannedQty');
    const plannedQty = plannedQtyRaw ? parseFloat(plannedQtyRaw as string) : NaN;
    if (isNaN(plannedQty) || plannedQty <= 0) return { error: 'Planned Qty is required.' };

    const unit = (formData.get('unit') as string | null)?.trim() || '';
    const plannedStartRaw = (formData.get('plannedStart') as string | null)?.trim() || '';
    const plannedEndRaw = (formData.get('plannedEnd') as string | null)?.trim() || '';
    const machineId = (formData.get('machineId') as string | null)?.trim() || '';
    const machineOperator = (formData.get('machineOperator') as string | null)?.trim() || '';
    const machineOperatorId = (formData.get('machineOperatorId') as string | null)?.trim() || '';
    const notes = (formData.get('notes') as string | null)?.trim() || '';
    const status = (formData.get('status') as string | null)?.trim() || 'planned';

    const componentsRaw = (formData.get('components') as string | null) || '[]';
    let parsedComponents: CrmBomComponent[] = [];
    try {
      parsedComponents = JSON.parse(componentsRaw);
    } catch {
      parsedComponents = [];
    }

    const labourCost = parseFloat((formData.get('labourCost') as string | null) || '0') || 0;
    const overheadCost = parseFloat((formData.get('overheadCost') as string | null) || '0') || 0;
    const materialCost = parsedComponents.reduce((sum, c) => {
      const qty = Number.isFinite(c.qty) ? c.qty : 0;
      const cpu = Number.isFinite(c.costPerUnit ?? 0) ? c.costPerUnit ?? 0 : 0;
      return sum + qty * cpu;
    }, 0);

    const orderNo = orderNoRaw || `PO-${Date.now().toString().slice(-6)}`;

    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);

    if (isEditing) {
      await db.collection('crm_production_orders').updateOne(
        { _id: new ObjectId(orderId), userId: userObjectId } as Filter<Document>,
        {
          $set: {
            orderNo,
            bomRef: bomRef || undefined,
            bomId: bomId && ObjectId.isValid(bomId) ? new ObjectId(bomId) : undefined,
            finishedGoodId:
              finishedGoodId && ObjectId.isValid(finishedGoodId)
                ? new ObjectId(finishedGoodId)
                : undefined,
            finishedGoodName,
            plannedQty,
            unit,
            plannedStart: plannedStartRaw ? new Date(plannedStartRaw) : undefined,
            plannedEnd: plannedEndRaw ? new Date(plannedEndRaw) : undefined,
            machineId: machineId || undefined,
            machineOperator: machineOperator || undefined,
            machineOperatorId:
              machineOperatorId && ObjectId.isValid(machineOperatorId)
                ? new ObjectId(machineOperatorId)
                : undefined,
            notes: notes || undefined,
            status,
            components: parsedComponents,
            labourCost,
            overheadCost,
            materialCost,
            totalCost: Math.round((materialCost + labourCost + overheadCost) * 100) / 100,
            updatedAt: new Date(),
          },
        },
      );
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        action: 'update',
        entityKind: 'production_order',
        entityId: orderId,
        reason: `Updated PO ${orderNo}`,
      });
      revalidatePath('/dashboard/crm/inventory/production-orders');
      revalidatePath(`/dashboard/crm/inventory/production-orders/${orderId}`);
      return { message: 'Production order updated.', id: orderId };
    }

    const result = await db.collection('crm_production_orders').insertOne({
      userId: userObjectId,
      orderNo,
      bomRef: bomRef || undefined,
      bomId: bomId && ObjectId.isValid(bomId) ? new ObjectId(bomId) : undefined,
      finishedGoodId:
        finishedGoodId && ObjectId.isValid(finishedGoodId)
          ? new ObjectId(finishedGoodId)
          : undefined,
      finishedGoodName,
      plannedQty,
      actualYield: 0,
      scrap: 0,
      unit,
      plannedStart: plannedStartRaw ? new Date(plannedStartRaw) : undefined,
      plannedEnd: plannedEndRaw ? new Date(plannedEndRaw) : undefined,
      machineId: machineId || undefined,
      machineOperator: machineOperator || undefined,
      machineOperatorId:
        machineOperatorId && ObjectId.isValid(machineOperatorId)
          ? new ObjectId(machineOperatorId)
          : undefined,
      notes: notes || undefined,
      status,
      components: parsedComponents,
      labourCost,
      overheadCost,
      materialCost,
      totalCost: Math.round((materialCost + labourCost + overheadCost) * 100) / 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      action: 'create',
      entityKind: 'production_order',
      entityId: result.insertedId.toString(),
      reason: `Created PO ${orderNo}`,
    });

    revalidatePath('/dashboard/crm/inventory/production-orders');
    return { message: 'Production order created.', id: result.insertedId.toString() };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('saveProductionOrder error:', msg);
    recordRustFallback({ entity: 'production_order', op: 'create' });
    return { error: `Failed to create production order: ${msg}` };
  }
}

export async function setProductionOrderStatus(
  orderId: string,
  status:
    | 'planned'
    | 'released'
    | 'in_progress'
    | 'paused'
    | 'qa_check'
    | 'completed'
    | 'closed'
    | 'cancelled',
): Promise<{ success: boolean; error?: string }> {
  if (!ObjectId.isValid(orderId)) return { success: false, error: 'Invalid order id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  const guard = await requirePermission('crm_production_order', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    const { db } = await connectToDatabase();
    await db.collection('crm_production_orders').updateOne(
      { _id: new ObjectId(orderId), userId: new ObjectId(session.user._id as string) } as Filter<Document>,
      { $set: { status, updatedAt: new Date() } },
    );
    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      action: 'status_change',
      entityKind: 'production_order',
      entityId: orderId,
      reason: `Status → ${status}`,
    });
    revalidatePath(`/dashboard/crm/inventory/production-orders/${orderId}`);
    revalidatePath('/dashboard/crm/inventory/production-orders');
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    recordRustFallback({ entity: 'production_order', op: 'update' });
    return { success: false, error: msg };
  }
}

export async function updateProductionOrderYield(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };
  const guard = await requirePermission('crm_production_order', 'edit');
  if (!guard.ok) return { error: guard.error };

  const orderId = (formData.get('orderId') as string | null)?.trim() || '';
  if (!ObjectId.isValid(orderId)) return { error: 'Invalid order ID.' };

  const actualYieldRaw = formData.get('actualYield');
  const actualYield = actualYieldRaw ? parseFloat(actualYieldRaw as string) : NaN;
  if (isNaN(actualYield) || actualYield < 0) return { error: 'Valid actual yield is required.' };

  const status = (formData.get('status') as string | null) || undefined;
  const notes = (formData.get('notes') as string | null)?.trim() || undefined;
  const scrapRaw = formData.get('scrap');
  const scrap = scrapRaw ? parseFloat(scrapRaw as string) : NaN;

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_production_orders').updateOne(
      {
        _id: new ObjectId(orderId),
        userId: new ObjectId(session.user._id as string),
      } as Filter<Document>,
      {
        $set: {
          actualYield,
          ...(Number.isFinite(scrap) ? { scrap } : {}),
          ...(status ? { status } : {}),
          ...(notes !== undefined ? { notes } : {}),
          updatedAt: new Date(),
        },
      },
    );
    if (result.matchedCount === 0) return { error: 'Order not found.' };
    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      action: 'update',
      entityKind: 'production_order',
      entityId: orderId,
      reason: `Yield updated → ${actualYield}`,
    });
    revalidatePath(`/dashboard/crm/inventory/production-orders/${orderId}`);
    revalidatePath('/dashboard/crm/inventory/production-orders');
    return { message: 'Yield updated successfully.' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    recordRustFallback({ entity: 'production_order', op: 'update' });
    return { error: `Failed to update yield: ${msg}` };
  }
}

export async function deleteProductionOrder(
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!ObjectId.isValid(orderId)) return { success: false, error: 'Invalid order id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  const guard = await requirePermission('crm_production_order', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    const { db } = await connectToDatabase();
    await db.collection('crm_production_orders').deleteOne({
      _id: new ObjectId(orderId),
      userId: new ObjectId(session.user._id as string),
    } as Filter<Document>);
    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      action: 'delete',
      entityKind: 'production_order',
      entityId: orderId,
    });
    revalidatePath('/dashboard/crm/inventory/production-orders');
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    recordRustFallback({ entity: 'production_order', op: 'delete' });
    return { success: false, error: msg };
  }
}

export async function bulkProductionOrderAction(
  ids: string[],
  op:
    | 'delete'
    | 'status_planned'
    | 'status_released'
    | 'status_in_progress'
    | 'status_completed'
    | 'status_closed'
    | 'status_cancelled',
): Promise<{ success: boolean; processed: number; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, processed: 0, error: 'Access denied.' };
  const guard = await requirePermission(
    'crm_production_order',
    op === 'delete' ? 'delete' : 'edit',
  );
  if (!guard.ok) return { success: false, processed: 0, error: guard.error };
  const validIds = ids.filter((id) => ObjectId.isValid(id));
  if (validIds.length === 0) return { success: false, processed: 0, error: 'No valid ids.' };
  try {
    const { db } = await connectToDatabase();
    const objIds = validIds.map((id) => new ObjectId(id));
    let processed = 0;
    if (op === 'delete') {
      const r = await db
        .collection('crm_production_orders')
        .deleteMany({
          _id: { $in: objIds },
          userId: new ObjectId(session.user._id as string),
        } as Filter<Document>);
      processed = r.deletedCount ?? 0;
    } else {
      const status = op.replace('status_', '');
      const r = await db.collection('crm_production_orders').updateMany(
        {
          _id: { $in: objIds },
          userId: new ObjectId(session.user._id as string),
        } as Filter<Document>,
        { $set: { status, updatedAt: new Date() } },
      );
      processed = r.modifiedCount ?? 0;
    }
    for (const id of validIds) {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        action: op === 'delete' ? 'delete' : 'status_change',
        entityKind: 'production_order',
        entityId: id,
        reason: `Bulk ${op}`,
      });
    }
    revalidatePath('/dashboard/crm/inventory/production-orders');
    return { success: true, processed };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    recordRustFallback({ entity: 'production_order', op: 'other' });
    return { success: false, processed: 0, error: msg };
  }
}
