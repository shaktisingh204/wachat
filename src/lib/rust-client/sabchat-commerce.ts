/**
 * Client for `/v1/sabchat/commerce/*` — conversational commerce: send a
 * product / catalog card and mint in-chat payment links (backed by SabPay).
 * Owned by the `sabchat-commerce` Rust crate.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface PaymentLinkResult {
  paymentRequestId: string;
  linkUrl: string;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const sabchatCommerceApi = {
  sendProduct: (conversationId: string, body: { productId: string }) =>
    rustFetch<{ messageId: string }>(
      `/v1/sabchat/commerce/send-product/${conversationId}`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  sendCatalog: (conversationId: string, body: { productIds: string[] }) =>
    rustFetch<{ messageId: string; count: number }>(
      `/v1/sabchat/commerce/send-catalog/${conversationId}`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  paymentLink: (
    conversationId: string,
    body: {
      amountMinor: number;
      currency: string;
      label?: string;
      provider?: string;
      expiresIn?: number;
    },
  ) =>
    rustFetch<PaymentLinkResult>(
      `/v1/sabchat/commerce/payment-link/${conversationId}`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  listPaymentRequests: (q: { conversationId?: string } = {}) =>
    rustFetch<{ paymentRequests: unknown[]; total: number }>(
      `/v1/sabchat/commerce/payment-requests${qs(q)}`,
    ),
};
