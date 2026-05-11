'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export async function saveCoupon(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { error: 'Unauthorized.' };
  }

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
