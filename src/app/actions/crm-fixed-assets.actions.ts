'use server';

import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { revalidatePath } from 'next/cache';

/**
 * Fetch a single fixed-asset document scoped to the current user.
 *
 * Mirrors the canonical loader shape used elsewhere in the CRM.
 */
export async function getFixedAssetById(
    assetId: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(assetId)) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_fixed_assets').findOne({
            _id: new ObjectId(assetId),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('Failed to fetch fixed asset by id:', e);
        return null;
    }
}

export async function saveFixedAsset(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { error: 'Access denied.' };
  }

  const rawAssetCode = (formData.get('assetCode') as string | null)?.trim() ?? '';
  const assetCode = rawAssetCode || `AST-${Date.now().toString().slice(-6)}`;

  const name = (formData.get('name') as string | null)?.trim() ?? '';
  if (!name) {
    return { error: 'Asset name is required.' };
  }

  const rawCost = (formData.get('cost') as string | null) ?? '';
  const cost = parseFloat(rawCost);
  if (!rawCost || isNaN(cost)) {
    return { error: 'Purchase cost is required.' };
  }

  const category = (formData.get('category') as string | null)?.trim() ?? '';
  const supplierName = (formData.get('supplierName') as string | null)?.trim() ?? '';
  const location = (formData.get('location') as string | null)?.trim() ?? '';
  const custodianName = (formData.get('custodianName') as string | null)?.trim() ?? '';
  const notes = (formData.get('notes') as string | null)?.trim() ?? '';

  const rawPurchaseDate = (formData.get('purchaseDate') as string | null) ?? '';
  const purchaseDate = rawPurchaseDate ? new Date(rawPurchaseDate) : undefined;

  const rawWarrantyExpiry = (formData.get('warrantyExpiry') as string | null) ?? '';
  const warrantyExpiry = rawWarrantyExpiry ? new Date(rawWarrantyExpiry) : undefined;

  const rawInsuranceExpiry = (formData.get('insuranceExpiry') as string | null) ?? '';
  const insuranceExpiry = rawInsuranceExpiry ? new Date(rawInsuranceExpiry) : undefined;

  const rawUsefulLifeMonths = (formData.get('usefulLifeMonths') as string | null) ?? '';
  const usefulLifeMonths = rawUsefulLifeMonths ? parseInt(rawUsefulLifeMonths, 10) : undefined;

  const depreciationMethod =
    (formData.get('depreciationMethod') as string | null) ?? 'slm';

  const rawResidualValue = (formData.get('residualValue') as string | null) ?? '';
  const residualValue = rawResidualValue ? parseFloat(rawResidualValue) : 0;

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_fixed_assets').insertOne({
      userId: new ObjectId(session.user._id as string),
      assetCode,
      name,
      category,
      purchaseDate,
      supplierName,
      cost,
      usefulLifeMonths,
      depreciationMethod,
      residualValue,
      location,
      custodianName,
      warrantyExpiry,
      insuranceExpiry,
      notes,
      status: 'active',
      accumulatedDepreciation: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath('/dashboard/crm/fixed-assets');
    return { message: 'Fixed asset saved successfully.', id: result.insertedId.toString() };
  } catch (e) {
    console.error('saveFixedAsset error:', e);
    return { error: 'Failed to save fixed asset. Please try again.' };
  }
}
