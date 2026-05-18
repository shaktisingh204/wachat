'use server';

/**
 * CRM Subscription server actions.
 *
 * Thin shims over the Rust BFF (`crmSubscriptionsApi`). No direct Mongo
 * access. FormData callers (the form page) hit `saveSubscriptionAction`
 * / `deleteSubscriptionAction`; programmatic callers can use the typed
 * helpers (`listSubscriptions`, `getSubscription`).
 *
 * NOTE: `'subscription'` is NOT registered in `WsCustomFieldBelongsTo`
 * — custom fields are intentionally skipped for this entity.
 */

import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';
import { RustApiError } from '@/lib/rust-client';
import {
  crmSubscriptionsApi,
  type CrmSubBillingFrequency,
  type CrmSubRenewalMode,
  type CrmSubStatus,
  type CrmSubscriptionCreateInput,
  type CrmSubscriptionDoc,
  type CrmSubscriptionItem,
  type CrmSubscriptionListParams,
  type CrmSubscriptionUpdateInput,
} from '@/lib/rust-client/crm-subscriptions';

const LIST_PATH = '/dashboard/crm/sales/subscriptions';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface SubscriptionListResult {
  subscriptions: CrmSubscriptionDoc[];
  page: number;
  limit: number;
  /** The Rust endpoint returns a bare array — there's no `total` field. */
  hasMore: boolean;
  error?: string;
}

export async function listSubscriptions(
  params: CrmSubscriptionListParams = {},
): Promise<SubscriptionListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  const session = await getSession();
  if (!session?.user) {
    return { subscriptions: [], page, limit, hasMore: false, error: 'Unauthorized' };
  }
  const guard = await requirePermission('crm_subscription', 'view');
  if (!guard.ok) {
    return { subscriptions: [], page, limit, hasMore: false, error: guard.error };
  }
  try {
    const subscriptions = await crmSubscriptionsApi.list({ ...params, page, limit });
    return {
      subscriptions,
      page,
      limit,
      hasMore: subscriptions.length === limit,
    };
  } catch (e) {
    console.error('[listSubscriptions] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'subscription', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { subscriptions: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getSubscription(
  id: string,
): Promise<{ subscription: CrmSubscriptionDoc | null; error?: string }> {
  if (!id) return { subscription: null, error: 'Missing subscription id.' };
  const session = await getSession();
  if (!session?.user) {
    return { subscription: null, error: 'Unauthorized' };
  }
  const guard = await requirePermission('crm_subscription', 'view');
  if (!guard.ok) {
    return { subscription: null, error: guard.error };
  }
  try {
    const subscription = await crmSubscriptionsApi.getById(id);
    return { subscription };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { subscription: null, error: 'Subscription not found.' };
    }
    console.error('[getSubscription] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'subscription', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { subscription: null, error: rustErr(e) };
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

function isBillingFrequency(v: string | undefined): v is CrmSubBillingFrequency {
  return (
    v === 'daily' ||
    v === 'weekly' ||
    v === 'monthly' ||
    v === 'quarterly' ||
    v === 'yearly' ||
    v === 'custom'
  );
}

function isRenewalMode(v: string | undefined): v is CrmSubRenewalMode {
  return v === 'auto' || v === 'manual';
}

function isoOrUndefined(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. Subscriptions do NOT support custom fields, so there is no
 * `customFields` post-write step.
 *
 * The form drives a single-line subscription (one `SubscriptionItem`)
 * — the picker selects the catalog item and the form captures qty,
 * rate, and currency. Multi-line carts are out of scope for the
 * standard CRUD surface; an "Add line" UX can be layered on later
 * without changing the action shape.
 */
export async function saveSubscriptionAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };

  const id = pickString(formData, '_id');
  const guard = await requirePermission('crm_subscription', id ? 'edit' : 'create');
  if (!guard.ok) return { error: guard.error };

  const customerId = pickString(formData, 'customerId');
  const itemId = pickString(formData, 'itemId');
  const frequencyRaw = pickString(formData, 'frequency');
  const renewalModeRaw = pickString(formData, 'renewalMode');
  const startedAtRaw = pickString(formData, 'startedAt');

  if (!customerId) return { error: 'Customer is required.' };
  if (!itemId) return { error: 'Plan / item is required.' };
  if (!isBillingFrequency(frequencyRaw)) {
    return { error: 'A valid billing cycle is required.' };
  }
  if (!isRenewalMode(renewalModeRaw)) {
    return { error: 'A valid renewal mode is required.' };
  }

  const startedAt = isoOrUndefined(startedAtRaw);
  if (!startedAt) return { error: 'A valid start date is required.' };

  const qty = pickNumber(formData, 'qty') ?? 1;
  const rate = pickNumber(formData, 'rate') ?? 0;
  const currency = pickString(formData, 'currency') ?? 'INR';

  const item: CrmSubscriptionItem = {
    itemId,
    qty,
    rate,
    currency,
  };

  const trialUntil = isoOrUndefined(pickString(formData, 'trialUntil'));
  const nextBillingAt = isoOrUndefined(pickString(formData, 'nextBillingAt'));
  const planId = pickString(formData, 'planId');

  const draft: CrmSubscriptionCreateInput = {
    customerId,
    planId,
    frequency: frequencyRaw,
    renewalMode: renewalModeRaw,
    startedAt,
    trialUntil,
    nextBillingAt,
    items: [item],
    prorationEnabled: pickString(formData, 'prorationEnabled') === 'on',
  };

  try {
    let result: CrmSubscriptionDoc;
    if (id) {
      // PATCH cannot change customerId / startedAt — strip them from the
      // patch body. Everything else is editable.
      const patch: CrmSubscriptionUpdateInput = {
        planId: draft.planId,
        frequency: draft.frequency,
        renewalMode: draft.renewalMode,
        trialUntil: draft.trialUntil,
        nextBillingAt: draft.nextBillingAt,
        items: draft.items,
        prorationEnabled: draft.prorationEnabled,
      };
      result = await crmSubscriptionsApi.update(id, patch);
    } else {
      result = await crmSubscriptionsApi.create(draft);
    }

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: id ? 'update' : 'create',
        entityKind: 'subscription',
        entityId: String(result._id),
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Subscription updated.' : 'Subscription created.',
      id: String(result._id),
    };
  } catch (e) {
    console.error('[saveSubscriptionAction] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'subscription', op: id ? 'update' : 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a subscription. The Rust handler removes the row from
 * the collection — no soft-delete flag.
 */
export async function deleteSubscriptionAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing subscription id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_subscription', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    await crmSubscriptionsApi.delete(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'subscription',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Subscription not found.' };
    }
    console.error('[deleteSubscriptionAction] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'subscription', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Lifecycle actions ───────────────────────────────────────── */

export async function setSubscriptionStatus(
  id: string,
  status: CrmSubStatus,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing subscription id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_subscription', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    const patch: CrmSubscriptionUpdateInput = { status };
    await crmSubscriptionsApi.update(id, patch);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'status_change',
        entityKind: 'subscription',
        entityId: id,
        diff: { status: { after: status } },
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return { success: true };
  } catch (e) {
    console.error('[setSubscriptionStatus] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'subscription', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { success: false, error: rustErr(e) };
  }
}

export async function pauseSubscription(id: string) {
  return setSubscriptionStatus(id, 'paused' as CrmSubStatus);
}

export async function resumeSubscription(id: string) {
  return setSubscriptionStatus(id, 'active' as CrmSubStatus);
}

export async function cancelSubscription(id: string) {
  return setSubscriptionStatus(id, 'cancelled' as CrmSubStatus);
}
