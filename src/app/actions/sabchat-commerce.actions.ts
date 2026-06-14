'use server';

/**
 * SabChat conversational-commerce server actions — project-scoped over the
 * sabchat-commerce Rust crate (`/v1/sabchat/commerce/*`). Lets agents drop a
 * SabPay-backed payment link (or a product card) straight into a conversation;
 * the resulting message is fanned out live over the WS hub.
 */

import { rustClient } from '@/lib/rust-client';
import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getSabchatWorkspaceId } from '@/lib/sabchat/workspace';
import { getErrorMessage } from '@/lib/utils';

async function scoped<T>(fn: () => Promise<T>): Promise<T> {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) throw new Error('No active SabChat project selected.');
  return runWithRustTenant(wsId, fn);
}

export async function sendPaymentLink(
  conversationId: string,
  input: { amountMajor: number; currency: string; label?: string },
): Promise<{ ok: true; linkUrl: string } | { ok: false; error: string }> {
  const amountMinor = Math.round((input.amountMajor || 0) * 100);
  if (amountMinor <= 0) return { ok: false, error: 'Enter an amount greater than 0.' };
  const currency = (input.currency || 'USD').trim().toUpperCase();
  try {
    const res = await scoped(() =>
      rustClient.sabchatCommerce.paymentLink(conversationId, {
        amountMinor,
        currency,
        label: input.label?.trim() || undefined,
      }),
    );
    return { ok: true, linkUrl: res.linkUrl };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function sendProduct(
  conversationId: string,
  productId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!productId?.trim()) return { ok: false, error: 'Product id is required.' };
  try {
    await scoped(() =>
      rustClient.sabchatCommerce.sendProduct(conversationId, { productId: productId.trim() }),
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
