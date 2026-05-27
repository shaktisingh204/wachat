'use server';

/**
 * SabCheckout admin server actions.
 *
 * Authenticated server actions for the `/dashboard/sabcheckout/*`
 * surface — wraps the Rust BFF over pages, plans, sessions, customers,
 * subscriptions, and invoices.
 *
 * Every action requires a logged-in session and scopes by the
 * authenticated user's `userId` (enforced server-side by the Rust
 * crates — see each crate's `ownership_filter`).
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import {
  sabcheckoutPagesApi,
  type SabcheckoutPageCreateInput,
  type SabcheckoutPageDoc,
  type SabcheckoutPageListParams,
  type SabcheckoutPageListResponse,
  type SabcheckoutPageUpdateInput,
} from '@/lib/rust-client/sabcheckout-pages';
import {
  sabcheckoutPlansApi,
  type SabcheckoutPlanCreateInput,
  type SabcheckoutPlanDoc,
  type SabcheckoutPlanListParams,
  type SabcheckoutPlanListResponse,
  type SabcheckoutPlanUpdateInput,
} from '@/lib/rust-client/sabcheckout-plans';
import {
  sabcheckoutSessionsApi,
  type SabcheckoutSessionDoc,
  type SabcheckoutSessionListParams,
  type SabcheckoutSessionListResponse,
} from '@/lib/rust-client/sabcheckout-sessions';
import {
  sabcheckoutCustomersApi,
  type SabcheckoutCustomerDoc,
  type SabcheckoutCustomerListParams,
  type SabcheckoutCustomerListResponse,
} from '@/lib/rust-client/sabcheckout-customers';
import {
  sabcheckoutSubscriptionsApi,
  type SabcheckoutSubscriptionDoc,
  type SabcheckoutSubscriptionListParams,
  type SabcheckoutSubscriptionListResponse,
} from '@/lib/rust-client/sabcheckout-subscriptions';
import {
  sabcheckoutInvoicesApi,
  type SabcheckoutInvoiceDoc,
  type SabcheckoutInvoiceListParams,
  type SabcheckoutInvoiceListResponse,
} from '@/lib/rust-client/sabcheckout-invoices';
import { getCheckoutGateway } from '@/lib/sabcheckout/gateway';

/* ─── Auth helper ─────────────────────────────────────────────────── */

async function requireUser(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { ok: false, error: 'Unauthorized.' };
  return { ok: true };
}

/* ─── Pages ───────────────────────────────────────────────────────── */

export async function listSabcheckoutPages(
  params?: SabcheckoutPageListParams,
): Promise<{ ok: true; data: SabcheckoutPageListResponse } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    const data = await sabcheckoutPagesApi.list(params);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getSabcheckoutPage(
  id: string,
): Promise<{ ok: true; data: SabcheckoutPageDoc } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    const data = await sabcheckoutPagesApi.getById(id);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createSabcheckoutPage(
  input: SabcheckoutPageCreateInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    const res = await sabcheckoutPagesApi.create(input);
    revalidatePath('/dashboard/sabcheckout');
    return { ok: true, id: res.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateSabcheckoutPage(
  id: string,
  patch: SabcheckoutPageUpdateInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    await sabcheckoutPagesApi.update(id, patch);
    revalidatePath('/dashboard/sabcheckout');
    revalidatePath(`/dashboard/sabcheckout/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteSabcheckoutPage(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    await sabcheckoutPagesApi.delete(id);
    revalidatePath('/dashboard/sabcheckout');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ─── Plans ───────────────────────────────────────────────────────── */

export async function listSabcheckoutPlans(
  params?: SabcheckoutPlanListParams,
): Promise<{ ok: true; data: SabcheckoutPlanListResponse } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    const data = await sabcheckoutPlansApi.list(params);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getSabcheckoutPlan(
  id: string,
): Promise<{ ok: true; data: SabcheckoutPlanDoc } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    const data = await sabcheckoutPlansApi.getById(id);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createSabcheckoutPlan(
  input: SabcheckoutPlanCreateInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    const res = await sabcheckoutPlansApi.create(input);
    revalidatePath('/dashboard/sabcheckout/plans');
    return { ok: true, id: res.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateSabcheckoutPlan(
  id: string,
  patch: SabcheckoutPlanUpdateInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    await sabcheckoutPlansApi.update(id, patch);
    revalidatePath('/dashboard/sabcheckout/plans');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteSabcheckoutPlan(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    await sabcheckoutPlansApi.delete(id);
    revalidatePath('/dashboard/sabcheckout/plans');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ─── Sessions (read-only admin) ──────────────────────────────────── */

export async function listSabcheckoutSessions(
  params?: SabcheckoutSessionListParams,
): Promise<{ ok: true; data: SabcheckoutSessionListResponse } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    const data = await sabcheckoutSessionsApi.list(params);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getSabcheckoutSession(
  id: string,
): Promise<{ ok: true; data: SabcheckoutSessionDoc } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    const data = await sabcheckoutSessionsApi.getById(id);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ─── Customers ───────────────────────────────────────────────────── */

export async function listSabcheckoutCustomers(
  params?: SabcheckoutCustomerListParams,
): Promise<{ ok: true; data: SabcheckoutCustomerListResponse } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    const data = await sabcheckoutCustomersApi.list(params);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getSabcheckoutCustomer(
  id: string,
): Promise<{ ok: true; data: SabcheckoutCustomerDoc } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    const data = await sabcheckoutCustomersApi.getById(id);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ─── Subscriptions ───────────────────────────────────────────────── */

export async function listSabcheckoutSubscriptions(
  params?: SabcheckoutSubscriptionListParams,
): Promise<
  | { ok: true; data: SabcheckoutSubscriptionListResponse }
  | { ok: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    const data = await sabcheckoutSubscriptionsApi.list(params);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getSabcheckoutSubscription(
  id: string,
): Promise<
  { ok: true; data: SabcheckoutSubscriptionDoc } | { ok: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    const data = await sabcheckoutSubscriptionsApi.getById(id);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function cancelSabcheckoutSubscription(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    const sub = await sabcheckoutSubscriptionsApi.getById(id);
    // Best-effort gateway cancel; the Rust record flips regardless.
    try {
      await getCheckoutGateway().cancelSubscription({
        subscriptionId: id,
        providerSubscriptionId: sub.providerSubscriptionId,
      });
    } catch {
      /* swallow — record-level cancel is what matters for now */
    }
    await sabcheckoutSubscriptionsApi.cancel(id);
    revalidatePath('/dashboard/sabcheckout/subscriptions');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ─── Invoices ────────────────────────────────────────────────────── */

export async function listSabcheckoutInvoices(
  params?: SabcheckoutInvoiceListParams,
): Promise<
  | { ok: true; data: SabcheckoutInvoiceListResponse }
  | { ok: false; error: string }
> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    const data = await sabcheckoutInvoicesApi.list(params);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getSabcheckoutInvoice(
  id: string,
): Promise<{ ok: true; data: SabcheckoutInvoiceDoc } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  try {
    const data = await sabcheckoutInvoicesApi.getById(id);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
