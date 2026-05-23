'use server';

/**
 * CRM Coupon server actions.
 *
 * **Dual implementation:** when `USE_RUST_CRM === 'true'` the read paths
 * delegate to `/v1/crm/coupons` on the Rust BFF; otherwise the legacy
 * direct-Mongo path runs. Failures are recorded via `recordRustFallback`
 * and fall through to the legacy path so the UI never breaks.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmCouponsApi } from '@/lib/rust-client/crm-coupons';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

export async function saveCoupon(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { error: 'Unauthorized.' };
  }
  const guard = await requirePermission('crm_coupon', 'create');
  if (!guard.ok) return { error: guard.error };

  try {
    const code = ((formData.get('code') as string) || '').trim().toUpperCase();
    if (!code) {
      return { error: 'Coupon code is required.' };
    }

    const type = (formData.get('type') as string) || 'percent';

    const rawValue = formData.get('value') as string;
    const value = rawValue ? parseFloat(rawValue) : 0;

    const rawMinCart = formData.get('minCart') as string;
    const minCart = rawMinCart ? parseFloat(rawMinCart) : undefined;

    const rawMaxUses = formData.get('maxUses') as string;
    const maxUses = rawMaxUses ? parseInt(rawMaxUses, 10) : undefined;

    const rawPerCustomerLimit = formData.get('perCustomerLimit') as string;
    const perCustomerLimit = rawPerCustomerLimit
      ? parseInt(rawPerCustomerLimit, 10)
      : undefined;

    const rawValidFrom = formData.get('validFrom') as string;
    const validFrom = rawValidFrom ? new Date(rawValidFrom) : undefined;

    const rawValidTo = formData.get('validTo') as string;
    const validTo = rawValidTo ? new Date(rawValidTo) : undefined;

    const rawApplicableProducts = formData.get('applicableProducts') as string;
    let applicableProducts: string[] | undefined;
    if (rawApplicableProducts) {
      try {
        applicableProducts = JSON.parse(rawApplicableProducts);
      } catch {
        applicableProducts = undefined;
      }
    }

    const rawApplicableCategories = formData.get('applicableCategories') as string;
    let applicableCategories: string[] | undefined;
    if (rawApplicableCategories) {
      applicableCategories = rawApplicableCategories
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
    }

    const stackable = formData.get('stackable') === 'true';

    const notes = (formData.get('notes') as string) || '';

    const now = new Date();

    const doc: Record<string, any> = {
      userId: new ObjectId(session.user._id as string),
      code,
      type,
      value,
      stackable,
      status: 'draft',
      usedCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    if (minCart !== undefined) doc.minCart = minCart;
    if (maxUses !== undefined) doc.maxUses = maxUses;
    if (perCustomerLimit !== undefined) doc.perCustomerLimit = perCustomerLimit;
    if (validFrom) doc.validFrom = validFrom;
    if (validTo) doc.validTo = validTo;
    if (applicableProducts) doc.applicableProducts = applicableProducts;
    if (applicableCategories && applicableCategories.length > 0) {
      doc.applicableCategories = applicableCategories;
    }
    if (notes) doc.notes = notes;

    const { db } = await connectToDatabase();
    const result = await db.collection('crm_coupons').insertOne(doc);

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'create',
        entityKind: 'coupon',
        entityId: result.insertedId.toString(),
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath('/dashboard/crm/sales/coupons');

    return { message: 'Coupon created successfully.', id: result.insertedId.toString() };
  } catch (e: any) {
    console.error('saveCoupon error:', e);
    return { error: e?.message || 'Failed to create coupon.' };
  }
}

export async function getCoupons(): Promise<{ coupons: any[]; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { coupons: [], error: 'Unauthorized.' };
  }

  if (useRustCrm()) {
    try {
      const resp = await crmCouponsApi.list({ page: 0, limit: 50 });
      return { coupons: JSON.parse(JSON.stringify(resp.items)) };
    } catch (e) {
      console.error('[getCoupons] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'coupon',
        op: 'list',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const docs = await db
      .collection('crm_coupons')
      .find({ userId: new ObjectId(session.user._id as string) })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return { coupons: JSON.parse(JSON.stringify(docs)) };
  } catch (e: any) {
    console.error('getCoupons error:', e);
    return { coupons: [], error: e?.message || 'Failed to fetch coupons.' };
  }
}

export async function getCouponById(
  couponId: string,
): Promise<Record<string, any> | null> {
  if (!couponId || !ObjectId.isValid(couponId)) return null;

  const session = await getSession();
  if (!session?.user?._id) return null;

  if (useRustCrm()) {
    try {
      const doc = await crmCouponsApi.getById(couponId);
      return JSON.parse(JSON.stringify(doc));
    } catch (e) {
      console.error('[getCouponById] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'coupon',
        op: 'get',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('crm_coupons').findOne({
      _id: new ObjectId(couponId),
      userId: new ObjectId(session.user._id as string),
    });
    return doc ? JSON.parse(JSON.stringify(doc)) : null;
  } catch (e) {
    console.error('getCouponById error:', e);
    return null;
  }
}

export async function updateCoupon(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { error: 'Unauthorized.' };
  }
  const guard = await requirePermission('crm_coupon', 'edit');
  if (!guard.ok) return { error: guard.error };

  const couponId = (formData.get('couponId') as string | null) || '';
  if (!couponId || !ObjectId.isValid(couponId)) {
    return { error: 'Invalid coupon id.' };
  }

  try {
    const code = ((formData.get('code') as string) || '').trim().toUpperCase();
    if (!code) return { error: 'Coupon code is required.' };

    const type = (formData.get('type') as string) || 'percent';
    const rawValue = formData.get('value') as string;
    const value = rawValue ? parseFloat(rawValue) : 0;
    const rawMinCart = formData.get('minCart') as string;
    const rawMaxUses = formData.get('maxUses') as string;
    const rawPerCustomerLimit = formData.get('perCustomerLimit') as string;
    const rawValidFrom = formData.get('validFrom') as string;
    const rawValidTo = formData.get('validTo') as string;
    const stackable = formData.get('stackable') === 'true';
    const notes = (formData.get('notes') as string) || '';
    const rawApplicableCategories = formData.get('applicableCategories') as string;

    const $set: Record<string, any> = {
      code,
      type,
      value,
      stackable,
      notes,
      updatedAt: new Date(),
    };
    if (rawMinCart) $set.minCart = parseFloat(rawMinCart);
    if (rawMaxUses) $set.maxUses = parseInt(rawMaxUses, 10);
    if (rawPerCustomerLimit)
      $set.perCustomerLimit = parseInt(rawPerCustomerLimit, 10);
    if (rawValidFrom) $set.validFrom = new Date(rawValidFrom);
    if (rawValidTo) $set.validTo = new Date(rawValidTo);
    
    if (rawApplicableCategories) {
      const cats = rawApplicableCategories.split(',').map((c) => c.trim()).filter(Boolean);
      if (cats.length > 0) {
        $set.applicableCategories = cats;
      } else {
        $set.applicableCategories = [];
      }
    } else if (formData.has('applicableCategories')) {
      $set.applicableCategories = [];
    }

    const { db } = await connectToDatabase();
    const result = await db.collection('crm_coupons').updateOne(
      {
        _id: new ObjectId(couponId),
        userId: new ObjectId(session.user._id as string),
      },
      { $set },
    );

    if (result.matchedCount === 0) {
      return { error: 'Coupon not found.' };
    }

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'update',
        entityKind: 'coupon',
        entityId: couponId,
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath('/dashboard/crm/sales/coupons');
    revalidatePath(`/dashboard/crm/sales/coupons/${couponId}`);
    return { message: 'Coupon updated successfully.', id: couponId };
  } catch (e: any) {
    console.error('updateCoupon error:', e);
    return { error: e?.message || 'Failed to update coupon.' };
  }
}

/* ──────────────────────────────────────────────────────────────────────
 * Deep-list additions (KPIs, filtered list, bulk ops).
 * Mongo-only — Rust BFF parity can land later without touching callers.
 * ──────────────────────────────────────────────────────────────────── */

export interface CrmCouponKpis {
  total: number;
  active: number;
  expired: number;
  totalRedemptions: number;
}

export interface CrmCouponListFilters {
  search?: string;
  status?: string;
  createdAfter?: Date | string;
  createdBefore?: Date | string;
}

export async function getCouponKpis(): Promise<CrmCouponKpis> {
  const empty: CrmCouponKpis = { total: 0, active: 0, expired: 0, totalRedemptions: 0 };
  const session = await getSession();
  if (!session?.user?._id) return empty;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);
    const baseFilter = { userId };

    const [total, active, expired, redemptionAgg] = await Promise.all([
      db.collection('crm_coupons').countDocuments(baseFilter),
      db.collection('crm_coupons').countDocuments({ ...baseFilter, status: 'active' }),
      db.collection('crm_coupons').countDocuments({ ...baseFilter, status: 'expired' }),
      db
        .collection('crm_coupons')
        .aggregate([
          { $match: baseFilter },
          { $group: { _id: null, sum: { $sum: { $ifNull: ['$usedCount', 0] } } } },
        ])
        .toArray(),
    ]);

    const totalRedemptions = Number(redemptionAgg?.[0]?.sum ?? 0);
    return { total, active, expired, totalRedemptions };
  } catch (e) {
    console.error('[getCouponKpis] failed:', e);
    return empty;
  }
}

export async function listCoupons(
  page = 1,
  limit = 20,
  filters: CrmCouponListFilters = {},
): Promise<{ rows: Array<Record<string, unknown>>; total: number }> {
  const session = await getSession();
  if (!session?.user?._id) return { rows: [], total: 0 };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);
    const query: Record<string, unknown> = { userId };

    if (filters.status && filters.status !== 'all') query.status = filters.status;
    if (filters.search) {
      const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.code = { $regex: safe, $options: 'i' };
    }
    if (filters.createdAfter || filters.createdBefore) {
      const range: Record<string, Date> = {};
      if (filters.createdAfter) range.$gte = new Date(filters.createdAfter);
      if (filters.createdBefore) range.$lte = new Date(filters.createdBefore);
      query.createdAt = range;
    }

    const skip = Math.max(0, (page - 1) * limit);
    const [docs, total] = await Promise.all([
      db
        .collection('crm_coupons')
        .find(query as never)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('crm_coupons').countDocuments(query as never),
    ]);

    return { rows: JSON.parse(JSON.stringify(docs)), total };
  } catch (e) {
    console.error('[listCoupons] failed:', e);
    return { rows: [], total: 0 };
  }
}

export async function bulkCouponAction(
  ids: string[],
  op: 'delete' | 'status',
  payload?: string,
): Promise<{ success: boolean; processed: number; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, processed: 0, error: 'Unauthorized.' };

  const guard = await requirePermission(
    'crm_coupon',
    op === 'delete' ? 'delete' : 'edit',
  );
  if (!guard.ok) return { success: false, processed: 0, error: guard.error };

  const valid = (ids ?? []).filter((id) => typeof id === 'string' && ObjectId.isValid(id));
  if (valid.length === 0) {
    return { success: false, processed: 0, error: 'No valid coupons selected.' };
  }

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);
    const oids = valid.map((id) => new ObjectId(id));
    const baseFilter = { _id: { $in: oids }, userId };

    let processed = 0;
    if (op === 'delete') {
      const r = await db.collection('crm_coupons').deleteMany(baseFilter);
      processed = r.deletedCount ?? 0;
    } else {
      const status = String(payload ?? '').trim();
      if (!status) {
        return { success: false, processed: 0, error: 'Status is required.' };
      }
      const r = await db.collection('crm_coupons').updateMany(baseFilter, {
        $set: { status, updatedAt: new Date() },
      });
      processed = r.modifiedCount ?? 0;
    }

    for (const id of valid) {
      try {
        await writeAuditEntry({
          tenantUserId: String(session.user._id),
          actorId: String(session.user._id),
          action: op === 'delete' ? 'delete' : 'status_change',
          entityKind: 'coupon',
          entityId: id,
          reason: payload ? `bulk:${payload}` : `bulk:${op}`,
        });
      } catch {
        /* non-fatal */
      }
    }

    revalidatePath('/dashboard/crm/sales/coupons');
    return { success: true, processed };
  } catch (e: any) {
    console.error('[bulkCouponAction] failed:', e);
    return { success: false, processed: 0, error: e?.message || 'Bulk action failed.' };
  }
}
