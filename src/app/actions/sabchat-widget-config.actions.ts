'use server';

/**
 * SabChat widget-config server actions — project-scoped read/write of an
 * inbox's `channelConfig.settings` (the canonical store the public
 * `/v1/sabchat/widget/config` endpoint reads). Powers the Widget Studio.
 */

import { revalidatePath } from 'next/cache';

import { rustClient } from '@/lib/rust-client';
import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getSabchatWorkspaceId } from '@/lib/sabchat/workspace';
import { getErrorMessage } from '@/lib/utils';
import {
  coerceWidgetConfig,
  type WidgetConfig,
} from '@/lib/sabchat/widget-config';

async function scoped<T>(fn: () => Promise<T>): Promise<T> {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) throw new Error('No active SabChat project selected.');
  return runWithRustTenant(wsId, fn);
}

export interface WidgetInboxRow {
  id: string;
  name: string;
}

/** Website inboxes available to attach a widget to. */
export async function listWidgetInboxes(): Promise<WidgetInboxRow[]> {
  try {
    const res = await scoped(() =>
      rustClient.sabchat.inboxes.list({ channelType: 'website' }),
    );
    return res.items.map((i) => ({ id: i._id, name: i.name }));
  } catch {
    return [];
  }
}

export async function getWidgetConfig(
  inboxId: string,
): Promise<{ config: WidgetConfig; inboxName: string } | null> {
  try {
    const inbox = await scoped(() => rustClient.sabchat.inboxes.get(inboxId));
    return {
      config: coerceWidgetConfig(
        inbox.channelConfig?.settings as Record<string, unknown> | undefined,
      ),
      inboxName: inbox.name,
    };
  } catch {
    return null;
  }
}

export async function saveWidgetConfig(
  inboxId: string,
  config: WidgetConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await scoped(() =>
      rustClient.sabchat.inboxes.update(inboxId, {
        channelConfig: { settings: { ...config } as Record<string, unknown> },
      }),
    );
    revalidatePath('/sabchat/widget');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
