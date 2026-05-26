'use server';

/**
 * QuickBooks Online — server actions for the settings UI.
 *
 * These actions are the only entry points the page component talks to.
 * Anything that touches the QuickBooks API (or stored secrets) lives in
 * `@/lib/integrations/quickbooks/*` so the page itself stays pure UI.
 */
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getSession } from '@/app/actions/user.actions';
import {
  appendSyncLog,
  getRecentSyncLog,
  getSettings,
  upsertSettings,
} from '@/lib/integrations/quickbooks/db';
import {
  encryptClientSecret,
  resolveRedirectUri,
} from '@/lib/integrations/quickbooks/auth';
import {
  syncAllClients,
  syncAllInvoices,
} from '@/lib/integrations/quickbooks/sync';
import type {
  QuickBooksEnvironment,
  QuickBooksStatus,
  SyncResult,
} from '@/lib/integrations/quickbooks/types';

const SETTINGS_PATH = '/dashboard/crm/settings/integrations/quickbooks';

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export interface SyncActionResult {
  ok: boolean;
  result: SyncResult;
  error?: string;
}

export interface SyncLogEntry {
  timestamp: string;
  action: string;
  entity: string;
  status: 'success' | 'failure';
  error?: string;
  refId?: string;
  quickbooksId?: string;
}

async function requireUserId(): Promise<ObjectId | null> {
  const session = await getSession();
  if (!session?.user?._id) return null;
  const raw = String(session.user._id);
  if (!ObjectId.isValid(raw)) return null;
  return new ObjectId(raw);
}

/**
 * Lightweight status used to render the settings page. Never throws.
 */
export async function getQuickBooksStatus(): Promise<QuickBooksStatus> {
  const redirectUri = await resolveRedirectUri();
  const userId = await requireUserId();
  if (!userId) {
    return {
      connected: false,
      hasCredentials: false,
      redirectUri,
    };
  }
  try {
    const setting = await getSettings(userId);
    if (!setting) {
      return {
        connected: false,
        hasCredentials: false,
        redirectUri,
        environment: 'sandbox',
        autoSync: false,
      };
    }
    return {
      connected: Boolean(setting.connected),
      realmId: setting.realmId,
      lastSync: setting.lastSync
        ? new Date(setting.lastSync).toISOString()
        : undefined,
      environment: setting.environment,
      autoSync: Boolean(setting.autoSync),
      hasCredentials: Boolean(
        setting.client_id && setting.client_secret_enc,
      ),
      redirectUri,
    };
  } catch (err) {
    console.error('[quickbooks.actions] getStatus failed:', err);
    return {
      connected: false,
      hasCredentials: false,
      redirectUri,
    };
  }
}

export interface SaveCredentialsInput {
  client_id: string;
  client_secret: string;
  environment: QuickBooksEnvironment;
  autoSync: boolean;
}

/**
 * Save the tenant's QuickBooks app credentials and auto-sync flag.
 * If `client_secret` is empty the existing encrypted value is kept
 * (lets the user toggle `autoSync` without re-entering the secret).
 */
export async function saveQuickBooksCredentials(
  data: SaveCredentialsInput,
): Promise<SaveResult> {
  try {
    const userId = await requireUserId();
    if (!userId) return { ok: false, error: 'Not authenticated' };

    if (data.environment !== 'sandbox' && data.environment !== 'production') {
      return { ok: false, error: 'Invalid environment' };
    }
    const existing = await getSettings(userId);
    const clientIdInput = (data.client_id ?? '').trim();
    const effectiveClientId =
      clientIdInput.length > 0 ? clientIdInput : (existing?.client_id ?? '');
    if (!effectiveClientId) {
      return { ok: false, error: 'Client ID is required' };
    }

    const patch: Record<string, unknown> = {
      client_id: effectiveClientId,
      environment: data.environment,
      autoSync: Boolean(data.autoSync),
    };
    const secretInput = (data.client_secret ?? '').trim();
    if (secretInput.length > 0) {
      patch.client_secret_enc = encryptClientSecret(secretInput);
    } else if (!existing?.client_secret_enc) {
      return { ok: false, error: 'Client Secret is required' };
    }
    if (existing === null) {
      patch.connected = false;
    }
    await upsertSettings(userId, patch as never);
    revalidatePath(SETTINGS_PATH);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[quickbooks.actions] saveCredentials failed:', msg);
    return { ok: false, error: msg };
  }
}

export async function disconnectQuickBooks(): Promise<SaveResult> {
  try {
    const userId = await requireUserId();
    if (!userId) return { ok: false, error: 'Not authenticated' };

    await upsertSettings(userId, {
      connected: false,
      access_token: undefined,
      refresh_token: undefined,
      expires_at: undefined,
      refresh_token_expires_at: undefined,
      realmId: undefined,
    });
    await appendSyncLog(userId, {
      action: 'disconnect',
      entity: 'connection',
      status: 'success',
    });
    revalidatePath(SETTINGS_PATH);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[quickbooks.actions] disconnect failed:', msg);
    return { ok: false, error: msg };
  }
}

export async function triggerSyncClients(): Promise<SyncActionResult> {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return {
        ok: false,
        result: { ok: 0, failed: 0, errors: [] },
        error: 'Not authenticated',
      };
    }
    const result = await syncAllClients(String(userId));
    revalidatePath(SETTINGS_PATH);
    return { ok: result.failed === 0, result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[quickbooks.actions] syncClients failed:', msg);
    return {
      ok: false,
      result: { ok: 0, failed: 0, errors: [{ id: 'exception', message: msg }] },
      error: msg,
    };
  }
}

export async function triggerSyncInvoices(): Promise<SyncActionResult> {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return {
        ok: false,
        result: { ok: 0, failed: 0, errors: [] },
        error: 'Not authenticated',
      };
    }
    const result = await syncAllInvoices(String(userId));
    revalidatePath(SETTINGS_PATH);
    return { ok: result.failed === 0, result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[quickbooks.actions] syncInvoices failed:', msg);
    return {
      ok: false,
      result: { ok: 0, failed: 0, errors: [{ id: 'exception', message: msg }] },
      error: msg,
    };
  }
}

export async function getQuickBooksSyncLog(): Promise<SyncLogEntry[]> {
  try {
    const userId = await requireUserId();
    if (!userId) return [];
    const rows = await getRecentSyncLog(userId, 20);
    return rows.map((r) => ({
      timestamp: r.timestamp.toISOString(),
      action: r.action,
      entity: r.entity,
      status: r.status,
      error: r.error,
      refId: r.refId,
      quickbooksId: r.quickbooksId,
    }));
  } catch (err) {
    console.error('[quickbooks.actions] getSyncLog failed:', err);
    return [];
  }
}
