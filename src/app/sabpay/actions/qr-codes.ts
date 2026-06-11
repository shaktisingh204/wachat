'use server';

/**
 * SabPay dashboard — QR Code server actions.
 *
 * Thin pass-through to the SabPay router on the Rust engine
 * (`rust/crates/sabpay`, mounted at `/v1/sabpay`). `rustClient.sabpay.*`
 * authenticates as the current SabNode session via the shared-secret JWT, so
 * every read/write is automatically scoped to the signed-in merchant. Mutations
 * return `{ error }` instead of throwing so the client can render inline
 * messages; reads return the data (or `null` on 404) or surface through the
 * route's error boundary.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type {
  SabpayCreateQrCodeBody,
  SabpayStatusListQuery,
} from '@/lib/rust-client/sabpay';
import type { SabpayQrCode } from '@/lib/sabpay/types';

function errorMessage(err: unknown): string {
  if (err instanceof RustApiError) return err.message;
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/* ── Reads ───────────────────────────────────────────────────────────────── */

export async function getSabpayQrCodes(
  query: SabpayStatusListQuery = {},
): Promise<SabpayQrCode[]> {
  const { qrCodes } = await rustClient.sabpay.listQrCodes(query);
  return qrCodes;
}

export async function getSabpayQrCodeDetail(
  id: string,
): Promise<SabpayQrCode | null> {
  try {
    return await rustClient.sabpay.getQrCode(id);
  } catch (err) {
    if (err instanceof RustApiError && err.status === 404) return null;
    throw err;
  }
}

/* ── Mutations ───────────────────────────────────────────────────────────── */

export async function createSabpayQrCode(
  input: SabpayCreateQrCodeBody,
  idempotencyKey?: string,
): Promise<{ qrCode?: SabpayQrCode; error?: string }> {
  try {
    const qrCode = await rustClient.sabpay.createQrCode(input, idempotencyKey);
    revalidatePath('/sabpay');
    revalidatePath('/sabpay/qr-codes');
    return { qrCode };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}

export async function closeSabpayQrCode(
  id: string,
): Promise<{ qrCode?: SabpayQrCode; error?: string }> {
  try {
    const qrCode = await rustClient.sabpay.closeQrCode(id);
    revalidatePath('/sabpay');
    revalidatePath('/sabpay/qr-codes');
    revalidatePath(`/sabpay/qr-codes/${id}`);
    return { qrCode };
  } catch (err) {
    return { error: errorMessage(err) };
  }
}
