'use server';

/**
 * CRM Fixed Asset server actions.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, mutations delegate to `/v1/crm/fixed-assets`
 *    on the Rust BFF via `src/lib/rust-client/crm-fixed-assets.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs.
 *
 * Export shapes are identical across both paths so the existing pages at
 * `/dashboard/crm/fixed-assets/**` keep working without changes.
 */

import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import {
    crmFixedAssetsApi,
    type CrmFixedAssetCreateInput,
    type CrmFixedAssetDoc,
} from '@/lib/rust-client/crm-fixed-assets';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { revalidatePath } from 'next/cache';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/** Map a Rust DTO into a loose Record shape the legacy callers expect. */
function rustDocToLegacy(
    doc: CrmFixedAssetDoc,
): WithId<Record<string, unknown>> {
    return JSON.parse(JSON.stringify(doc)) as WithId<Record<string, unknown>>;
}

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
    if (!assetId) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmFixedAssetsApi.getById(assetId);
            return doc ? rustDocToLegacy(doc) : null;
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            console.error('[getFixedAssetById] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'fixed_asset', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

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

  const guard = await requirePermission('crm_asset', 'create');
  if (!guard.ok) return { error: guard.error };

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

  // Currency defaults to INR to match the Rust DTO requirement.
  const currency =
    (formData.get('currency') as string | null)?.trim() || 'INR';

  if (useRustCrm()) {
    try {
      const purchaseDateIso = purchaseDate
        ? purchaseDate.toISOString()
        : new Date().toISOString();

      const draft: CrmFixedAssetCreateInput = {
        code: assetCode,
        name,
        category: category || undefined,
        purchaseDate: purchaseDateIso,
        supplierId: supplierName || undefined,
        cost,
        currency,
        usefulLifeMonths:
          usefulLifeMonths && usefulLifeMonths > 0 ? usefulLifeMonths : 12,
        depreciationMethod,
        residualValue,
        location: location || undefined,
        custodianEmployeeId: custodianName || undefined,
        warrantyUntil: warrantyExpiry ? warrantyExpiry.toISOString() : undefined,
        insuranceUntil: insuranceExpiry
          ? insuranceExpiry.toISOString()
          : undefined,
      };
      const result = await crmFixedAssetsApi.create(draft);
      const id = String(result._id ?? '');
      try {
        await writeAuditEntry({
          tenantUserId: String(session.user._id),
          actorId: String(session.user._id),
          action: 'create',
          entityKind: 'fixed_asset',
          entityId: id,
        });
      } catch {
        /* non-fatal */
      }
      revalidatePath('/dashboard/crm/fixed-assets');
      void notes;
      return { message: 'Fixed asset saved successfully.', id };
    } catch (e) {
      console.error('[saveFixedAsset] rust path failed; falling back:', e);
      recordRustFallback({ entity: 'fixed_asset', op: 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
      // fall through to legacy on failure so users aren't blocked
    }
  }

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
      currency,
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

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'create',
        entityKind: 'fixed_asset',
        entityId: result.insertedId.toString(),
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath('/dashboard/crm/fixed-assets');
    return { message: 'Fixed asset saved successfully.', id: result.insertedId.toString() };
  } catch (e) {
    console.error('saveFixedAsset error:', e);
    return { error: 'Failed to save fixed asset. Please try again.' };
  }
}

/**
 * Triggers the depreciation calculation for a given asset.
 */
export async function depreciateFixedAsset(
    assetId: string,
): Promise<{ message?: string; error?: string; asset?: Record<string, unknown> }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };
    if (!assetId) return { error: 'Invalid asset ID.' };

    const guard = await requirePermission('crm_asset', 'update');
    if (!guard.ok) return { error: guard.error };

    if (useRustCrm()) {
        try {
            const doc = await crmFixedAssetsApi.depreciate(assetId);
            revalidatePath('/dashboard/crm/fixed-assets');
            return { message: 'Asset depreciated successfully.', asset: rustDocToLegacy(doc) };
        } catch (e) {
            console.error('[depreciateFixedAsset] rust path failed:', e);
            recordRustFallback({ entity: 'fixed_asset', op: 'depreciate', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            return { error: 'Failed to depreciate asset.' };
        }
    }

    return { error: 'Legacy depreciation path is not supported. Enable Rust CRM.' };
}
