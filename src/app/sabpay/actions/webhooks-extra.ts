'use server';

/**
 * SabPay dashboard — Webhook delivery-log server actions.
 *
 * Thin pass-through to the SabPay router on the Rust engine
 * (`rust/crates/sabpay`, mounted at `/v1/sabpay`) via `rustClient.sabpay.*`.
 * This complements the endpoint CRUD in `../actions.ts`: it reads the delivery
 * log and re-fires a single delivery. A redelivery appends a new attempt row,
 * so it revalidates the webhooks surface.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { SabpayWebhookDeliveryQuery } from '@/lib/rust-client/sabpay';
import type { SabpayWebhookDelivery } from '@/lib/sabpay/types';

function errorMessage(err: unknown): string {
  if (err instanceof RustApiError) return err.message;
  return err instanceof Error ? err.message : 'Something went wrong.';
}

export async function getSabpayWebhookDeliveries(
  query: SabpayWebhookDeliveryQuery = {},
): Promise<SabpayWebhookDelivery[]> {
  return rustClient.sabpay.listWebhookDeliveries({
    endpointId: query.endpointId,
    event: query.event,
    success: query.success,
    before: query.before,
    limit: query.limit ?? 50,
  });
}

export async function redeliverSabpayWebhook(
  id: string,
): Promise<{ delivery?: SabpayWebhookDelivery; error?: string }> {
  try {
    const delivery = await rustClient.sabpay.redeliverWebhook(id);
    revalidatePath('/sabpay/webhooks');
    return { delivery };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
