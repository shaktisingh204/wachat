'use server';

import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import {
  addSabmailSuppression,
  listSabmailSuppressionsRaw,
  removeSabmailSuppression,
  type SabmailSuppressionRaw,
  type SabmailSuppressionReason,
} from '@/lib/sabmail/suppressions';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail — Suppressions surface actions.
 *
 * Thin, tenant-scoped wrappers around the plain server lib
 * (`src/lib/sabmail/suppressions.ts`). Every action resolves the active
 * SabMail workspace from the session/cookie and refuses when none is
 * selected — the lib itself is session-agnostic (webhooks pass the
 * workspaceId explicitly), so the tenancy gate lives here.
 * ──────────────────────────────────────────────────────────────────── */

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
type VoidResult = { ok: true } | { ok: false; error: string };

const MANUAL_REASONS: SabmailSuppressionReason[] = [
  'manual',
  'bounce',
  'complaint',
  'unsubscribe',
];

/** List the active workspace's suppressions (newest first). */
export async function listSabmailSuppressions(): Promise<
  Result<{ suppressions: SabmailSuppressionRaw[] }>
> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  try {
    const suppressions = await listSabmailSuppressionsRaw(workspaceId);
    return { ok: true, suppressions };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/** Manually add an address to the active workspace's suppression list. */
export async function addSuppressionManual(
  email: string,
  reason?: string,
): Promise<VoidResult> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  const normalized = String(email ?? '').trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  const requested = String(reason ?? '').trim().toLowerCase() as SabmailSuppressionReason;
  const resolvedReason: SabmailSuppressionReason = MANUAL_REASONS.includes(requested)
    ? requested
    : 'manual';

  try {
    await addSabmailSuppression(workspaceId, normalized, resolvedReason, 'manual');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/** Remove an address from the active workspace's suppression list. */
export async function removeSuppression(email: string): Promise<VoidResult> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  const normalized = String(email ?? '').trim().toLowerCase();
  if (!normalized) return { ok: false, error: 'No address to remove.' };

  try {
    await removeSabmailSuppression(workspaceId, normalized);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
