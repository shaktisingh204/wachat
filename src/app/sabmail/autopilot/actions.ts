'use server';

import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import { getSession } from '@/app/actions/user.actions';
import { archiveSabmailMessage, setSabmailFlag } from '@/app/sabmail/inbox/actions';
import {
  proposeAutopilotActions,
  type AutopilotProposal,
} from '@/lib/sabmail/autopilot';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail — AI Autopilot (propose → human approve → execute → audit).
 *
 * The lib proposes inbox actions; nothing is mutated until a human Approves a
 * single proposal here. Every executed action writes an audit doc to
 * `SABMAIL_COLLECTIONS.audit` with `kind:'autopilot'`, the actor (`'ai'`), and
 * the approver — so the trail is complete and tenant-scoped by `workspaceId`.
 * ──────────────────────────────────────────────────────────────────── */

export type AutopilotActionKind = 'archive' | 'label' | 'keep';

/** One executable action approved by a human. */
export interface ApplyAutopilotActionInput {
  uid: number;
  action: AutopilotActionKind;
  label?: string;
}

/** Audit doc shape (one Mongo doc). */
interface AutopilotAuditDoc {
  workspaceId: string;
  kind: 'autopilot';
  action: string;
  uid?: number;
  detail: string;
  actor: 'ai';
  approvedBy?: string;
  ts: Date;
}

/** Safe (serialisable) projection of an audit row. */
export interface AutopilotAuditRow {
  id: string;
  action: string;
  uid: number | null;
  detail: string;
  actor: 'ai';
  approvedBy: string | null;
  ts: string;
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
type VoidResult = { ok: true } | { ok: false; error: string };

function toAuditRow(doc: WithId<AutopilotAuditDoc>): AutopilotAuditRow {
  return {
    id: String(doc._id),
    action: doc.action,
    uid: typeof doc.uid === 'number' ? doc.uid : null,
    detail: doc.detail,
    actor: 'ai',
    approvedBy: doc.approvedBy ?? null,
    ts: doc.ts instanceof Date ? doc.ts.toISOString() : new Date(doc.ts).toISOString(),
  };
}

async function currentApprover(): Promise<string | undefined> {
  try {
    const session = await getSession();
    const user = session?.user as { email?: unknown; name?: unknown; _id?: unknown } | undefined;
    const email = user?.email ? String(user.email) : '';
    const name = user?.name ? String(user.name) : '';
    return email || name || (user?._id ? String(user._id) : undefined);
  } catch {
    return undefined;
  }
}

/* ── actions ─────────────────────────────────────────────────────────── */

/** Get fresh AI proposals for the active workspace's mailbox. */
export async function getAutopilotProposals(
  accountId: string,
): Promise<Result<{ proposals: AutopilotProposal[] }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  try {
    const res = await proposeAutopilotActions(workspaceId, accountId);
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, proposals: res.proposals };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/**
 * Execute ONE human-approved action against the mailbox, then audit it.
 * `archive` moves the message out of the inbox; `label` flags it (a durable,
 * IMAP-native marker — SabMail has no server-side label store yet) and records
 * the suggested label name in the audit detail; `keep` is a no-op that is still
 * audited so the decision is on record.
 */
export async function applyAutopilotAction(
  accountId: string,
  input: ApplyAutopilotActionInput,
): Promise<VoidResult> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  const accId = accountId?.trim();
  if (!accId || !ObjectId.isValid(accId)) {
    return { ok: false, error: 'Pick a mailbox first.' };
  }
  const uid = Number(input?.uid);
  if (!Number.isFinite(uid)) return { ok: false, error: 'Invalid message.' };

  const action = input.action;
  const label = input.label?.trim() ? input.label.trim().slice(0, 40) : undefined;

  // Execute the approved action via the existing inbox mutations.
  try {
    if (action === 'archive') {
      const res = await archiveSabmailMessage(accId, 'INBOX', uid);
      if (!res.ok) return { ok: false, error: res.error };
    } else if (action === 'label') {
      // No server-side label store yet — flag the message as a durable marker.
      const res = await setSabmailFlag(accId, 'INBOX', uid, 'flagged', true);
      if (!res.ok) return { ok: false, error: res.error };
    } else if (action !== 'keep') {
      return { ok: false, error: 'Unknown action.' };
    }
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }

  // Write the audit doc (best-effort — never fail the user-visible action on it).
  try {
    const approvedBy = await currentApprover();
    const detail =
      action === 'archive'
        ? 'Archived from inbox.'
        : action === 'label'
          ? `Labelled${label ? ` "${label}"` : ''} (flagged in mailbox).`
          : 'Kept in inbox (no change).';
    const doc: AutopilotAuditDoc = {
      workspaceId,
      kind: 'autopilot',
      action,
      uid,
      detail,
      actor: 'ai',
      ...(approvedBy ? { approvedBy } : {}),
      ts: new Date(),
    };
    const { db } = await connectToDatabase();
    await db.collection(SABMAIL_COLLECTIONS.audit).insertOne(doc as never);
  } catch (e) {
    console.error('[sabmail] applyAutopilotAction audit failed:', e);
  }

  return { ok: true };
}

/** List recent autopilot audit entries for the active workspace (newest first). */
export async function listAutopilotAudit(): Promise<AutopilotAuditRow[]> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return [];

    const { db } = await connectToDatabase();
    const docs = await db
      .collection(SABMAIL_COLLECTIONS.audit)
      .find({ workspaceId, kind: 'autopilot' })
      .sort({ ts: -1 })
      .limit(50)
      .toArray();

    return docs.map((d) => toAuditRow(d as unknown as WithId<AutopilotAuditDoc>));
  } catch (err) {
    console.error('[sabmail] listAutopilotAudit failed:', err);
    return [];
  }
}
