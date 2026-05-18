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
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

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
  const session = await getSession();
  if (!session?.user) {
    return { assets: [], page, limit, hasMore: false, error: 'Unauthorized' };
  }
  const guard = await requirePermission('crm_fixed_asset', 'view');
  if (!guard.ok) {
    return { assets: [], page, limit, hasMore: false, error: guard.error };
  }
  try {
    const assets = await crmFixedAssetsApi.list({ ...params, page, limit });
    return { assets, page, limit, hasMore: assets.length === limit };
  } catch (e) {
    console.error('[listFixedAssets] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'fixed_asset', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { assets: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getFixedAsset(
  id: string,
): Promise<{ asset: CrmFixedAssetDoc | null; error?: string }> {
  if (!id) return { asset: null, error: 'Missing fixed-asset id.' };
  const session = await getSession();
  if (!session?.user) {
    return { asset: null, error: 'Unauthorized' };
  }
  const guard = await requirePermission('crm_fixed_asset', 'view');
  if (!guard.ok) {
    return { asset: null, error: guard.error };
  }
  try {
    const asset = await crmFixedAssetsApi.getById(id);
    return { asset };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { asset: null, error: 'Fixed asset not found.' };
    }
    console.error('[getFixedAsset] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'fixed_asset', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
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
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };

  const id = pickString(formData, '_id');
  const guard = await requirePermission('crm_fixed_asset', id ? 'edit' : 'create');
  if (!guard.ok) return { error: guard.error };

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

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: id ? 'update' : 'create',
        entityKind: 'fixed_asset',
        entityId: String(result._id),
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Fixed asset updated.' : 'Fixed asset created.',
      id: String(result._id),
    };
  } catch (e) {
    console.error('[saveFixedAssetAction] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'fixed_asset', op: id ? 'update' : 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
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
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_fixed_asset', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    await crmFixedAssetsApi.delete(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'fixed_asset',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Fixed asset not found.' };
    }
    console.error('[deleteFixedAssetAction] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'fixed_asset', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
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

/* ─── Lifecycle helpers ──────────────────────────────────────── */
//
// These actions piggy-back on the Rust PATCH endpoint by sending
// targeted partial updates. They emit an audit row via `writeAuditEntry`
// so the Activity feed records the lifecycle event distinctly from a
// generic edit.

export async function assignFixedAsset(
  assetId: string,
  employeeId: string,
  from?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Unauthorized' };
  if (!assetId) return { success: false, error: 'Missing fixed-asset id.' };
  if (!employeeId)
    return { success: false, error: 'Employee is required.' };
  const guard = await requirePermission('crm_fixed_asset', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    await crmFixedAssetsApi.update(assetId, {
      custodianEmployeeId: employeeId,
    });
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'assign',
        entityKind: 'fixed_asset',
        entityId: assetId,
        reason: from ? `From ${from}` : undefined,
        diff: { custodianEmployeeId: { after: employeeId } },
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${assetId}`);
    return { success: true };
  } catch (e) {
    console.error('[assignFixedAsset] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'fixed_asset', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { success: false, error: rustErr(e) };
  }
}

export async function unassignFixedAsset(
  assetId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Unauthorized' };
  if (!assetId) return { success: false, error: 'Missing fixed-asset id.' };
  const guard = await requirePermission('crm_fixed_asset', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    // Rust PATCH treats `undefined` fields as no-op. Send an empty
    // string to clear the custodian — the BFF maps it to None / null.
    await crmFixedAssetsApi.update(assetId, {
      custodianEmployeeId: '',
    });
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'assign',
        entityKind: 'fixed_asset',
        entityId: assetId,
        reason: 'unassigned',
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${assetId}`);
    return { success: true };
  } catch (e) {
    console.error('[unassignFixedAsset] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'fixed_asset', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { success: false, error: rustErr(e) };
  }
}

/**
 * Run depreciation. Until a dedicated Rust endpoint exists, this writes
 * an audit row only — the actual numeric calc must happen via the
 * scheduled depreciation job (see `crm-jobs` worker).
 * TODO 1D.2: needs server-side endpoint to mutate accumulated depreciation.
 */
export async function runDepreciation(
  assetId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Unauthorized' };
  if (!assetId) return { success: false, error: 'Missing fixed-asset id.' };
  try {
    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action: 'update',
      entityKind: 'fixed_asset',
      entityId: assetId,
      reason: 'depreciation_requested',
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: rustErr(e) };
  }
}

export async function retireFixedAsset(
  assetId: string,
  payload: { date: string; saleValue?: number; reason: string },
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Unauthorized' };
  if (!assetId) return { success: false, error: 'Missing fixed-asset id.' };
  if (!payload.date)
    return { success: false, error: 'Retirement date is required.' };
  const guard = await requirePermission('crm_fixed_asset', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    // Capture the disposition by setting condition + emitting audit.
    // Rust DTO doesn't accept retireOrSell on PATCH yet, so we keep the
    // numeric retirement in the audit log until the BFF grows the field.
    await crmFixedAssetsApi.update(assetId, {
      condition: 'retired',
    });
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'archive',
        entityKind: 'fixed_asset',
        entityId: assetId,
        reason: payload.reason,
        diff: {
          condition: { after: 'retired' },
          retirementDate: { after: payload.date },
          saleValue: { after: payload.saleValue ?? 0 },
        },
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${assetId}`);
    return { success: true };
  } catch (e) {
    console.error('[retireFixedAsset] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'fixed_asset', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { success: false, error: rustErr(e) };
  }
}
