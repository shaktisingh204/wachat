'use server';

/**
 * CRM Fixed Asset server actions.
 *
 * Thin shims over the Rust BFF (`crmFixedAssetsApi`). No direct Mongo
 * access. FormData callers (the list page + form) hit
 * `saveFixedAssetAction` / `deleteFixedAssetAction`; programmatic
 * callers can use the typed helpers (`listFixedAssets`, `getFixedAsset`,
 * `createFixedAsset`, `updateFixedAsset`, `deleteFixedAsset`).
 *
 * Custom fields are intentionally NOT wired here — `fixedAsset` is not
 * a member of `WsCustomFieldBelongsTo`, so the form/detail UIs skip the
 * custom-fields panel entirely.
 */

import { revalidatePath } from 'next/cache';
import { RustApiError } from '@/lib/rust-client';
import {
  crmFixedAssetsApi,
  type CrmFixedAssetCreateInput,
  type CrmFixedAssetDoc,
  type CrmFixedAssetListParams,
  type CrmFixedAssetUpdateInput,
} from '@/lib/rust-client/crm-fixed-assets';

const LIST_PATH = '/dashboard/crm/fixed-assets';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface FixedAssetListResult {
  assets: CrmFixedAssetDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listFixedAssets(
  params: CrmFixedAssetListParams = {},
): Promise<FixedAssetListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const assets = await crmFixedAssetsApi.list({ ...params, page, limit });
    return { assets, page, limit, hasMore: assets.length === limit };
  } catch (e) {
    return { assets: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getFixedAsset(
  id: string,
): Promise<{ asset: CrmFixedAssetDoc | null; error?: string }> {
  if (!id) return { asset: null, error: 'Missing fixed-asset id.' };
  try {
    const asset = await crmFixedAssetsApi.getById(id);
    return { asset };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { asset: null, error: 'Fixed asset not found.' };
    }
    return { asset: null, error: rustErr(e) };
  }
}

/* ─── Write ───────────────────────────────────────────────────── */

function pickString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function pickNumber(formData: FormData, key: string): number | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function pickInt(formData: FormData, key: string): number | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Turn a `<input type="date">` (`YYYY-MM-DD`) into a midnight-UTC ISO
 * string the Rust handler can parse. Bare `YYYY-MM-DD` is not valid
 * RFC-3339 on the Rust side.
 */
function pickDateIso(formData: FormData, key: string): string | undefined {
  const raw = pickString(formData, key);
  if (!raw) return undefined;
  // Already a full ISO timestamp — pass through.
  if (raw.includes('T')) return raw;
  // Plain date — anchor at midnight UTC so the wire string is RFC-3339.
  return `${raw}T00:00:00Z`;
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST.
 */
export async function saveFixedAssetAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const id = pickString(formData, '_id');

  const code = pickString(formData, 'code');
  const name = pickString(formData, 'name');
  const purchaseDate = pickDateIso(formData, 'purchaseDate');
  const cost = pickNumber(formData, 'cost');
  const currency = pickString(formData, 'currency') ?? 'INR';
  const usefulLifeMonths = pickInt(formData, 'usefulLifeMonths');
  const depreciationMethod = pickString(formData, 'depreciationMethod') ?? 'slm';

  if (!code || !name) {
    return { error: 'Code and name are required.' };
  }

  // For CREATE, the Rust handler requires purchaseDate, cost, currency,
  // usefulLifeMonths, depreciationMethod. For PATCH any subset is fine.
  if (!id) {
    if (!purchaseDate) return { error: 'Purchase date is required.' };
    if (cost == null) return { error: 'Cost is required.' };
    if (usefulLifeMonths == null || usefulLifeMonths <= 0) {
      return { error: 'Useful life (months) must be greater than zero.' };
    }
  }

  const baseDraft = {
    code,
    name,
    category: pickString(formData, 'category'),
    supplierId: pickString(formData, 'supplierId'),
    currency,
    depreciationMethod,
    residualValue: pickNumber(formData, 'residualValue'),
    location: pickString(formData, 'location'),
    custodianEmployeeId: pickString(formData, 'custodianEmployeeId'),
    condition: pickString(formData, 'condition'),
    warrantyUntil: pickDateIso(formData, 'warrantyUntil'),
    insuranceUntil: pickDateIso(formData, 'insuranceUntil'),
    amcContractId: pickString(formData, 'amcContractId'),
  };

  try {
    let result: CrmFixedAssetDoc;
    if (id) {
      const patch: CrmFixedAssetUpdateInput = {
        ...baseDraft,
        ...(purchaseDate ? { purchaseDate } : {}),
        ...(cost != null ? { cost } : {}),
        ...(usefulLifeMonths != null ? { usefulLifeMonths } : {}),
      };
      result = await crmFixedAssetsApi.update(id, patch);
    } else {
      const draft: CrmFixedAssetCreateInput = {
        ...baseDraft,
        purchaseDate: purchaseDate as string,
        cost: cost as number,
        usefulLifeMonths: usefulLifeMonths as number,
      };
      result = await crmFixedAssetsApi.create(draft);
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Fixed asset updated.' : 'Fixed asset created.',
      id: String(result._id),
    };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a fixed asset. The Rust handler removes the row from the
 * collection — no soft-delete flag.
 */
export async function deleteFixedAssetAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing fixed-asset id.' };
  try {
    await crmFixedAssetsApi.delete(id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Fixed asset not found.' };
    }
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */
//
// 'use server' files only allow async exports — these helpers thinly
// wrap the Rust client so callers don't have to remember `await
// crmFixedAssetsApi.x(...)`.

export async function createFixedAsset(input: CrmFixedAssetCreateInput) {
  return crmFixedAssetsApi.create(input);
}

export async function updateFixedAsset(id: string, patch: CrmFixedAssetUpdateInput) {
  return crmFixedAssetsApi.update(id, patch);
}

export async function deleteFixedAsset(id: string) {
  return crmFixedAssetsApi.delete(id);
}
