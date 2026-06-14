'use server';

import { revalidatePath } from 'next/cache';

import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import {
  listHostedMailboxesForWorkspace,
  provisionHostedMailboxForWorkspace,
  resetHostedMailboxPasswordForWorkspace,
  setHostedMailboxStatusForWorkspace,
  deleteHostedMailboxForWorkspace,
  type HostedMailboxProvisionInput,
  type Result,
  type VoidResult,
  type SabmailHostedMailboxRow,
} from '@/lib/sabmail/hosted-core';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail — HOSTED mailbox provisioning + management (server actions).
 *
 * These are the cookie-bound SabMail-UI entry points: each resolves the active
 * workspace from the `sabmail_project` cookie via `getSabmailWorkspaceId()`,
 * delegates to the cookie-free core in `@/lib/sabmail/hosted-core`, and
 * revalidates the SabMail accounts surface on success. The real provisioning
 * logic (Stalwart principal lifecycle, AES-GCM credential encryption,
 * dupe-rollback, one-time password) lives in the core so other modules — e.g.
 * the SabNode Admin Center — can provision mailboxes on a workspace they
 * resolve themselves, without going through this cookie.
 * ──────────────────────────────────────────────────────────────────── */

// Re-export the safe row projection type for the SabMail UI (mailboxes page).
export type { SabmailHostedMailboxRow } from '@/lib/sabmail/hosted-core';

/**
 * List the active workspace's hosted mailboxes (`provider:'hosted'`), each
 * annotated with the status of its underlying verified domain. Never returns
 * secrets.
 */
export async function listSabmailHostedMailboxes(): Promise<
  Result<{ mailboxes: SabmailHostedMailboxRow[] }>
> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  return listHostedMailboxesForWorkspace(workspaceId);
}

/**
 * Provision a brand-new hosted mailbox on the active workspace. A strong
 * password is generated when none is supplied and returned exactly once.
 */
export async function provisionSabmailHostedMailbox(
  input: HostedMailboxProvisionInput,
): Promise<Result<{ mailbox: SabmailHostedMailboxRow; generatedPassword?: string }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  const res = await provisionHostedMailboxForWorkspace(workspaceId, input);
  if (res.ok) revalidatePath('/sabmail/accounts');
  return res;
}

/**
 * Reset a hosted mailbox's password on the active workspace. When `newPassword`
 * is omitted a strong one is generated and returned exactly once.
 */
export async function resetSabmailHostedMailboxPassword(
  accountId: string,
  newPassword?: string,
): Promise<Result<{ generatedPassword?: string }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  const res = await resetHostedMailboxPasswordForWorkspace(workspaceId, accountId, newPassword);
  if (res.ok) revalidatePath('/sabmail/accounts');
  return res;
}

/** Suspend or re-activate a hosted mailbox on the active workspace. */
export async function setSabmailHostedMailboxStatus(
  accountId: string,
  status: 'active' | 'suspended',
): Promise<VoidResult> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  const res = await setHostedMailboxStatusForWorkspace(workspaceId, accountId, status);
  if (res.ok) revalidatePath('/sabmail/accounts');
  return res;
}

/** Permanently delete a hosted mailbox on the active workspace. */
export async function deleteSabmailHostedMailbox(
  accountId: string,
): Promise<VoidResult> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  const res = await deleteHostedMailboxForWorkspace(workspaceId, accountId);
  if (res.ok) revalidatePath('/sabmail/accounts');
  return res;
}
