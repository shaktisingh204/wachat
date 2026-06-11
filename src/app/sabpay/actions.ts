'use server';

/**
 * SabPay dashboard — server actions.
 *
 * Every action resolves the SabNode session itself and scopes all reads
 * and writes to that user (the merchant). Mutations return
 * `{ error }` instead of throwing so the client can render inline
 * messages; reads throw on missing auth (the layout already redirects).
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import {
  createApiKey,
  createPayment,
  getOrCreateMerchant,
  getPaymentDocById,
  getStats,
  listApiKeys,
  listPayments,
  paymentDocToPayment,
  revokeApiKey,
  updateMerchant,
  type UpdateMerchantPatch,
} from '@/lib/sabpay/db.server';
import {
  createEndpoint,
  deleteEndpoint,
  dispatchSabpayEvent,
  listDeliveries,
  listEndpoints,
  rotateEndpointSecret,
  updateEndpoint,
} from '@/lib/sabpay/webhooks.server';
import type {
  SabpayApiKey,
  SabpayMerchant,
  SabpayMode,
  SabpayPayment,
  SabpayPaymentStatus,
  SabpayStats,
  SabpayWebhookDelivery,
  SabpayWebhookEndpoint,
  SabpayWebhookEvent,
} from '@/lib/sabpay/types';

interface SabpayActor {
  userId: ObjectId;
  displayName: string;
}

async function requireActor(): Promise<SabpayActor> {
  const session = await getSession();
  const user = session?.user as
    | { _id?: unknown; name?: string; email?: string }
    | undefined;
  if (!user?._id || !ObjectId.isValid(String(user._id))) {
    throw new Error('Not authenticated.');
  }
  return {
    userId: new ObjectId(String(user._id)),
    displayName: user.name || user.email || 'My business',
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/* ── Overview ────────────────────────────────────────────────────────────── */

export interface SabpayOverviewData {
  merchant: SabpayMerchant;
  stats: SabpayStats;
  recent: SabpayPayment[];
}

export async function getSabpayOverview(): Promise<SabpayOverviewData> {
  const actor = await requireActor();
  const merchant = await getOrCreateMerchant(actor.userId, actor.displayName);
  const [stats, recent] = await Promise.all([
    getStats(actor.userId, merchant.mode),
    listPayments(actor.userId, { mode: merchant.mode, limit: 8 }),
  ]);
  return { merchant, stats, recent };
}

/* ── Payments ────────────────────────────────────────────────────────────── */

export async function getSabpayPayments(query: {
  status?: SabpayPaymentStatus;
  before?: string;
  limit?: number;
}): Promise<{ merchant: SabpayMerchant; payments: SabpayPayment[] }> {
  const actor = await requireActor();
  const merchant = await getOrCreateMerchant(actor.userId, actor.displayName);
  const payments = await listPayments(actor.userId, {
    mode: merchant.mode,
    status: query.status,
    before: query.before,
    limit: query.limit ?? 50,
  });
  return { merchant, payments };
}

export async function getSabpayPaymentDetail(
  id: string,
): Promise<SabpayPayment | null> {
  const actor = await requireActor();
  const doc = await getPaymentDocById(id);
  if (!doc || !doc.userId.equals(actor.userId)) return null;
  return paymentDocToPayment(doc);
}

/**
 * Dashboard-side payment creation ("create a payment link" without
 * touching the API) — same path the public API uses.
 */
export async function createSabpayPayment(input: {
  amount: number;
  description?: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ payment?: SabpayPayment; error?: string }> {
  try {
    const actor = await requireActor();
    const merchant = await getOrCreateMerchant(actor.userId, actor.displayName);
    const payment = await createPayment(actor.userId, merchant.mode, {
      amount: input.amount,
      description: input.description,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });
    void dispatchSabpayEvent(actor.userId, 'payment.created', payment);
    revalidatePath('/sabpay');
    revalidatePath('/sabpay/payments');
    return { payment };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/* ── API keys ────────────────────────────────────────────────────────────── */

export async function getSabpayKeys(): Promise<SabpayApiKey[]> {
  const actor = await requireActor();
  return listApiKeys(actor.userId);
}

export async function createSabpayKey(input: {
  name: string;
  mode: SabpayMode;
}): Promise<{ key?: SabpayApiKey; error?: string }> {
  try {
    const actor = await requireActor();
    if (input.mode !== 'test' && input.mode !== 'live') {
      return { error: 'Mode must be test or live.' };
    }
    const key = await createApiKey(actor.userId, input.name, input.mode);
    revalidatePath('/sabpay/developers');
    return { key };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function revokeSabpayKey(
  keyId: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const actor = await requireActor();
    const ok = await revokeApiKey(actor.userId, keyId);
    revalidatePath('/sabpay/developers');
    return ok ? { ok } : { error: 'Key not found.' };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/* ── Webhooks ────────────────────────────────────────────────────────────── */

export interface SabpayWebhookData {
  endpoints: SabpayWebhookEndpoint[];
  deliveries: SabpayWebhookDelivery[];
}

export async function getSabpayWebhookData(): Promise<SabpayWebhookData> {
  const actor = await requireActor();
  const [endpoints, deliveries] = await Promise.all([
    listEndpoints(actor.userId),
    listDeliveries(actor.userId, 50),
  ]);
  return { endpoints, deliveries };
}

export async function createSabpayWebhook(input: {
  url: string;
  events: SabpayWebhookEvent[];
  description?: string;
}): Promise<{ endpoint?: SabpayWebhookEndpoint; error?: string }> {
  try {
    const actor = await requireActor();
    const endpoint = await createEndpoint(actor.userId, input);
    revalidatePath('/sabpay/webhooks');
    return { endpoint };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function updateSabpayWebhook(
  id: string,
  patch: { active?: boolean; url?: string; events?: SabpayWebhookEvent[]; description?: string },
): Promise<{ endpoint?: SabpayWebhookEndpoint; error?: string }> {
  try {
    const actor = await requireActor();
    const endpoint = await updateEndpoint(actor.userId, id, patch);
    revalidatePath('/sabpay/webhooks');
    return endpoint ? { endpoint } : { error: 'Endpoint not found.' };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function rotateSabpayWebhookSecret(
  id: string,
): Promise<{ endpoint?: SabpayWebhookEndpoint; error?: string }> {
  try {
    const actor = await requireActor();
    const endpoint = await rotateEndpointSecret(actor.userId, id);
    revalidatePath('/sabpay/webhooks');
    return endpoint ? { endpoint } : { error: 'Endpoint not found.' };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function deleteSabpayWebhook(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const actor = await requireActor();
    const ok = await deleteEndpoint(actor.userId, id);
    revalidatePath('/sabpay/webhooks');
    return ok ? { ok } : { error: 'Endpoint not found.' };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

/* ── Settings ────────────────────────────────────────────────────────────── */

export async function getSabpaySettings(): Promise<SabpayMerchant> {
  const actor = await requireActor();
  return getOrCreateMerchant(actor.userId, actor.displayName);
}

export async function saveSabpaySettings(
  patch: UpdateMerchantPatch,
): Promise<{ merchant?: SabpayMerchant; error?: string }> {
  try {
    const actor = await requireActor();
    await getOrCreateMerchant(actor.userId, actor.displayName);
    const merchant = await updateMerchant(actor.userId, patch);
    revalidatePath('/sabpay');
    revalidatePath('/sabpay/settings');
    return merchant ? { merchant } : { error: 'Settings not found.' };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
