'use server';

/**
 * SabChat abandoned-cart recovery server actions — project-scoped over the
 * `sabchat-cart-recovery` Rust crate (`/v1/sabchat/cart-recovery/*`). Manages
 * recovery rules, reads the abandoned-cart list, fires a manual sweep, and
 * reads the trigger log. The storefront snippet reports cart events via the
 * separate public route surface, not from here.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getSabchatWorkspaceId } from '@/lib/sabchat/workspace';
import { getErrorMessage } from '@/lib/utils';
import type {
  SabChatCart,
  SabChatCartRule,
  SabChatCartTrigger,
} from '@/lib/rust-client/sabchat-cart-recovery';

const CART_PATH = '/sabchat/cart-recovery';

async function scoped<T>(fn: () => Promise<T>): Promise<T> {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) throw new Error('No active SabChat project selected.');
  return runWithRustTenant(wsId, fn);
}

type Mut = { ok: true } | { ok: false; error: string };

export async function listCartRules(): Promise<SabChatCartRule[]> {
  try {
    const res = await scoped(() => rustClient.sabchatCartRecovery.listRules());
    return res.items;
  } catch {
    return [];
  }
}

export async function listAbandonedCarts(): Promise<SabChatCart[]> {
  try {
    const res = await scoped(() =>
      rustClient.sabchatCartRecovery.listCarts({ status: 'abandoned', limit: 50 }),
    );
    return res.items;
  } catch {
    return [];
  }
}

export async function listCartTriggers(): Promise<SabChatCartTrigger[]> {
  try {
    const res = await scoped(() => rustClient.sabchatCartRecovery.listTriggers({ limit: 50 }));
    return res.items;
  } catch {
    return [];
  }
}

export async function saveCartRule(input: {
  id?: string;
  name: string;
  idleMinutes: number;
  minTotalMajor?: number;
  action: SabChatCartRule['action'];
  active?: boolean;
}): Promise<Mut> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: 'Name is required.' };
  if (!input.idleMinutes || input.idleMinutes < 1)
    return { ok: false, error: 'Idle minutes must be ≥ 1.' };
  const minTotalMinor =
    typeof input.minTotalMajor === 'number' && input.minTotalMajor > 0
      ? Math.round(input.minTotalMajor * 100)
      : undefined;
  try {
    await scoped(() =>
      input.id
        ? rustClient.sabchatCartRecovery.updateRule(input.id, {
            name,
            idleMinutes: input.idleMinutes,
            minTotalMinor,
            action: input.action,
            active: input.active,
          })
        : rustClient.sabchatCartRecovery.createRule({
            name,
            idleMinutes: input.idleMinutes,
            minTotalMinor,
            action: input.action,
            active: input.active ?? true,
          }),
    );
    revalidatePath(CART_PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function deleteCartRule(id: string): Promise<Mut> {
  try {
    await scoped(() => rustClient.sabchatCartRecovery.deleteRule(id));
    revalidatePath(CART_PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function sweepCarts(
  dryRun = false,
): Promise<{ ok: true; scanned: number; fired: number } | { ok: false; error: string }> {
  try {
    const res = await scoped(() => rustClient.sabchatCartRecovery.sweep({ dryRun }));
    if (!dryRun) revalidatePath(CART_PATH);
    return { ok: true, scanned: res.scanned, fired: res.fired };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
