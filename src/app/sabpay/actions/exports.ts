'use server';

/**
 * SabPay dashboard — CSV export server actions.
 *
 * Thin pass-through to the SabPay router on the Rust engine
 * (`rust/crates/sabpay`, mounted at `/v1/sabpay`) via `rustClient.sabpay.*`.
 * The Rust handler returns raw `text/csv`; this action wraps it in
 * `{ csv?, filename?, error? }` so the client can offer a download without
 * throwing through the error boundary. This is a read — it does not mutate, so
 * there is nothing to revalidate.
 */

import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { SabpayExportEntity, SabpayExportQuery } from '@/lib/rust-client/sabpay';

function errorMessage(err: unknown): string {
  if (err instanceof RustApiError) return err.message;
  return err instanceof Error ? err.message : 'Something went wrong.';
}

export async function exportSabpayCsv(
  entity: SabpayExportEntity,
  query: SabpayExportQuery = {},
): Promise<{ csv?: string; filename?: string; error?: string }> {
  try {
    const csv = await rustClient.sabpay.exportCsv(entity, query);
    const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `sabpay-${entity}-${stamp}.csv`;
    return { csv, filename };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
