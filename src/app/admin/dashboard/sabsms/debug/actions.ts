'use server';

import { getAdminSession } from '@/lib/admin-session';
import {
  sabsmsEngine,
  SabsmsEngineError,
} from '@/lib/sabsms/engine-client';
import type {
  SabsmsMessage,
  SabsmsMessageStatus,
} from '@/lib/sabsms/types';

export interface SendInput {
  to: string;
  body: string;
  dryRun?: boolean;
}

export type SendResult =
  | { ok: true; id: string; status: SabsmsMessageStatus }
  | { ok: false; error: string };

export type FetchResult =
  | { ok: true; message: SabsmsMessage }
  | { ok: false; error: string };

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { isAdmin } = await getAdminSession();
  return isAdmin ? { ok: true } : { ok: false, error: 'unauthorized' };
}

export async function sendDebugSms(input: SendInput): Promise<SendResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const workspaceId = input.dryRun
      ? '__admin_debug_dry_run__'
      : process.env.SABSMS_DEFAULT_WORKSPACE ?? '__admin_debug__';

    const res = await sabsmsEngine.enqueueSend({
      workspaceId,
      to: input.to,
      body: input.body,
      category: 'transactional',
      eventKey: 'admin.debug.send',
    });
    return { ok: true, id: res.id, status: res.status };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { ok: false, error: `${e.status} ${e.message}` };
    }
    return { ok: false, error: (e as Error)?.message ?? 'send failed' };
  }
}

export async function fetchDebugStatus(id: string): Promise<FetchResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const m = await sabsmsEngine.getMessage(id);
    if (!m) return { ok: false, error: 'message not found' };
    return { ok: true, message: m };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { ok: false, error: `${e.status} ${e.message}` };
    }
    return { ok: false, error: (e as Error)?.message ?? 'fetch failed' };
  }
}
