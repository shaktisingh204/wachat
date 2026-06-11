'use server';

/**
 * SabPay dashboard — Settlements server actions.
 *
 * Thin pass-through to the SabPay router on the Rust engine
 * (`rust/crates/sabpay`, mounted at `/v1/sabpay`) via `rustClient.sabpay.*`.
 * Settlements are read-only and always live-mode. Reads return the data (or
 * `null` on a 404, like `getSabpayPaymentDetail`); the route's error boundary
 * surfaces other failures.
 */

import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type {
  SabpaySettlementDetail,
  SabpaySettlementSummary,
  SabpaySettlementsList,
} from '@/lib/rust-client/sabpay';

export async function getSabpaySettlements(
  query: { before?: string; limit?: number } = {},
): Promise<SabpaySettlementsList> {
  return rustClient.sabpay.listSettlements({
    before: query.before,
    limit: query.limit ?? 50,
  });
}

export async function getSabpaySettlementSummary(): Promise<SabpaySettlementSummary> {
  return rustClient.sabpay.getSettlementSummary();
}

export async function getSabpaySettlementDetail(
  id: string,
): Promise<SabpaySettlementDetail | null> {
  try {
    return await rustClient.sabpay.getSettlement(id);
  } catch (err) {
    if (err instanceof RustApiError && err.status === 404) return null;
    throw err;
  }
}
