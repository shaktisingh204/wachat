'use server';

/**
 * SabChat config server actions — project-scoped CRUD for inboxes, macros
 * (canned responses), and dispositions (close reasons). Every call runs
 * inside `runWithRustTenant(workspaceId, …)` so the Rust `tid` claim is the
 * active SabChat project. Powers `/sabchat/admin/*` and the inbox composer's
 * `/`-menu + resolve-with-disposition flow.
 *
 * Separate from the legacy `sabchat-admin.actions.ts` (user-scoped, used by
 * the old `/dashboard/sabchat/admin`) which is left untouched until P7.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getSabchatWorkspaceId } from '@/lib/sabchat/workspace';
import { getErrorMessage } from '@/lib/utils';
import type { ChannelType, SabChatInbox } from '@/lib/rust-client/sabchat';
import type { SabChatMacro } from '@/lib/rust-client/sabchat-macros';
import type { SabChatDisposition } from '@/lib/rust-client/sabchat-dispositions';

const ADMIN_PATH = '/sabchat/admin';

async function scoped<T>(fn: () => Promise<T>): Promise<T> {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) throw new Error('No active SabChat project selected.');
  return runWithRustTenant(wsId, fn);
}

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: string };

async function mutate(
  run: () => Promise<unknown>,
  path = ADMIN_PATH,
): Promise<{ ok: true } | Err> {
  try {
    await scoped(run);
    revalidatePath(path);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/* -- Inboxes ------------------------------------------------------------- */

export async function listAdminInboxes(): Promise<{ items: SabChatInbox[]; error?: string }> {
  try {
    return await scoped(() => rustClient.sabchat.inboxes.list());
  } catch (e) {
    return { items: [], error: getErrorMessage(e) };
  }
}

export async function createInbox(input: {
  name: string;
  channelType?: ChannelType;
}): Promise<Ok<{ inbox: SabChatInbox }> | Err> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: 'Name is required.' };
  try {
    const inbox = await scoped(() =>
      rustClient.sabchat.inboxes.create({
        name,
        channelType: input.channelType ?? 'website',
      }),
    );
    revalidatePath(ADMIN_PATH);
    return { ok: true, inbox };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export const setInboxEnabled = async (id: string, enabled: boolean) =>
  mutate(() => rustClient.sabchat.inboxes.update(id, { enabled }));

export const deleteInbox = async (id: string) =>
  mutate(() => rustClient.sabchat.inboxes.delete(id));

/* -- Macros (canned responses) ------------------------------------------- */

export async function listMacros(): Promise<SabChatMacro[]> {
  try {
    const res = await scoped(() => rustClient.sabchatMacros.list());
    return res.items;
  } catch {
    return [];
  }
}

export async function saveMacro(input: {
  id?: string;
  name: string;
  content: string;
  active?: boolean;
}): Promise<{ ok: true } | Err> {
  const name = input.name?.trim();
  const content = input.content?.trim();
  if (!name || !content) return { ok: false, error: 'Name and content are required.' };
  return mutate(() =>
    input.id
      ? rustClient.sabchatMacros.update(input.id, { name, content, active: input.active })
      : rustClient.sabchatMacros.create({ name, content, active: input.active ?? true }),
  );
}

export const deleteMacro = async (id: string) =>
  mutate(() => rustClient.sabchatMacros.delete(id));

/* -- Dispositions (close reasons) ---------------------------------------- */

export async function listDispositions(): Promise<SabChatDisposition[]> {
  try {
    const res = await scoped(() => rustClient.sabchatDispositions.list({ active: true }));
    return res.items;
  } catch {
    return [];
  }
}

export async function saveDisposition(input: {
  id?: string;
  code: string;
  label: string;
  color?: string;
}): Promise<{ ok: true } | Err> {
  const code = input.code?.trim();
  const label = input.label?.trim();
  if (!code || !label) return { ok: false, error: 'Code and label are required.' };
  return mutate(() =>
    input.id
      ? rustClient.sabchatDispositions.update(input.id, { label, color: input.color })
      : rustClient.sabchatDispositions.create({ code, label, color: input.color }),
  );
}

export const deleteDisposition = async (id: string) =>
  mutate(() => rustClient.sabchatDispositions.delete(id));

/** Apply a disposition to a conversation (optionally resolving it). */
export async function applyDisposition(
  conversationId: string,
  code: string,
  opts: { note?: string; alsoResolve?: boolean } = {},
): Promise<{ ok: true } | Err> {
  return mutate(
    () =>
      rustClient.sabchatDispositions.apply(conversationId, {
        code,
        note: opts.note,
        alsoResolve: opts.alsoResolve ?? true,
      }),
    '/sabchat/inbox',
  );
}
