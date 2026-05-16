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
