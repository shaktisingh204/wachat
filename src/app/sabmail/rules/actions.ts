'use server';

import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import {
  compileSabmailRule,
  matchesSabmailRule,
  type SabmailRuleCompiled,
} from '@/lib/sabmail/rules-engine';
import {
  listSabmailMessages,
  searchSabmailMessages,
  type SabmailMessageRow,
} from '@/app/sabmail/inbox/actions';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail — Rules (natural-language → structured inbox rules).
 *
 * A rule is a tiny matcher + single action. `createSabmailRuleFromNl`
 * compiles the description via the rules engine (LLM) and stores the
 * structured result; `previewSabmailRule` runs the match over the live
 * INBOX (read-only — it NEVER mutates mail) and returns a count + sample.
 *
 * Live auto-apply lands with the background sync engine; for now rules run
 * on demand (preview) and via the future automation sweep. Every action is
 * tenant-scoped by the active SabMail `workspaceId`; the `rules` collection
 * is the SabMail roadmap's reserved name — no schema change here.
 * ──────────────────────────────────────────────────────────────────── */

/** The stored shape of a rule (one Mongo doc). */
export interface SabmailRuleDoc {
  workspaceId: string;
  name: string;
  /** The original natural-language description. */
  nl: string;
  compiled: SabmailRuleCompiled;
  enabled: boolean;
  createdAt: Date;
}

/** Safe (serialisable) projection sent to the client. */
export interface SabmailRuleRow {
  id: string;
  name: string;
  nl: string;
  compiled: SabmailRuleCompiled;
  enabled: boolean;
  createdAt: string;
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
type VoidResult = { ok: true } | { ok: false; error: string };

function toRow(doc: WithId<SabmailRuleDoc>): SabmailRuleRow {
  return {
    id: String(doc._id),
    name: doc.name || '(untitled rule)',
    nl: doc.nl ?? '',
    compiled: doc.compiled,
    enabled: doc.enabled !== false,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : new Date(doc.createdAt).toISOString(),
  };
}

/* ── actions ─────────────────────────────────────────────────────────── */

/** List rules for the active workspace (newest first). */
export async function listSabmailRules(): Promise<SabmailRuleRow[]> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return [];

    const { db } = await connectToDatabase();
    const docs = await db
      .collection<SabmailRuleDoc>(SABMAIL_COLLECTIONS.rules)
      .find({ workspaceId })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    return docs.map((d) => toRow(d as WithId<SabmailRuleDoc>));
  } catch (err) {
    console.error('[sabmail] listSabmailRules failed:', err);
    return [];
  }
}

/** Compile a natural-language rule and store it (enabled by default). */
export async function createSabmailRuleFromNl(input: {
  name: string;
  nl: string;
}): Promise<Result<{ rule: SabmailRuleRow }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  try {
    const name = input.name?.trim() || '';
    const nl = input.nl?.trim() || '';
    if (!nl) return { ok: false, error: 'Describe the rule in a sentence first.' };

    const compiledResult = await compileSabmailRule(nl);
    if (!compiledResult.ok) return { ok: false, error: compiledResult.error };

    const now = new Date();
    const doc: SabmailRuleDoc = {
      workspaceId,
      name: name || 'New rule',
      nl,
      compiled: compiledResult.compiled,
      enabled: true,
      createdAt: now,
    };

    const { db } = await connectToDatabase();
    const res = await db
      .collection<SabmailRuleDoc>(SABMAIL_COLLECTIONS.rules)
      .insertOne(doc as never);

    return { ok: true, rule: toRow({ ...doc, _id: res.insertedId } as WithId<SabmailRuleDoc>) };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/** Enable / disable a rule. */
export async function toggleSabmailRule(id: string, enabled: boolean): Promise<VoidResult> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  try {
    if (!id || !ObjectId.isValid(id)) return { ok: false, error: 'Invalid rule id.' };

    const { db } = await connectToDatabase();
    const res = await db
      .collection<SabmailRuleDoc>(SABMAIL_COLLECTIONS.rules)
      .updateOne({ _id: new ObjectId(id), workspaceId }, { $set: { enabled } });

    if (res.matchedCount === 0) return { ok: false, error: 'Rule not found.' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/** Delete a rule. */
export async function deleteSabmailRule(id: string): Promise<VoidResult> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  try {
    if (!id || !ObjectId.isValid(id)) return { ok: false, error: 'Invalid rule id.' };

    const { db } = await connectToDatabase();
    const res = await db
      .collection<SabmailRuleDoc>(SABMAIL_COLLECTIONS.rules)
      .deleteOne({ _id: new ObjectId(id), workspaceId });

    if (res.deletedCount === 0) return { ok: false, error: 'Rule not found.' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/* ── preview (read-only — runs the match over INBOX, never mutates) ────── */

export interface SabmailRulePreviewSample {
  uid: number;
  subject: string;
  fromName: string;
  fromEmail: string;
  date: string | null;
}

/**
 * Run a rule's match clause over the INBOX and return how many messages it
 * would touch plus a small sample. This is strictly read-only — it never
 * archives, labels, or marks anything; it just shows what the rule catches.
 *
 * Candidate fetch: when the rule has a text term (sender/subject) we seed an
 * IMAP search with it (cheap, server-side), then apply the full matcher
 * locally. With only an age condition we scan the most-recent inbox page.
 */
export async function previewSabmailRule(
  id: string,
  accountId: string,
): Promise<
  Result<{ count: number; scanned: number; sample: SabmailRulePreviewSample[] }>
> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  try {
    if (!id || !ObjectId.isValid(id)) return { ok: false, error: 'Invalid rule id.' };
    if (!accountId || !ObjectId.isValid(accountId)) {
      return { ok: false, error: 'Pick a mailbox to preview against.' };
    }

    const { db } = await connectToDatabase();
    const doc = (await db
      .collection<SabmailRuleDoc>(SABMAIL_COLLECTIONS.rules)
      .findOne({ _id: new ObjectId(id), workspaceId })) as WithId<SabmailRuleDoc> | null;
    if (!doc) return { ok: false, error: 'Rule not found.' };

    const compiled = doc.compiled;
    const term = compiled.match.fromContains || compiled.match.subjectContains || '';

    // Gather candidate messages from INBOX (read-only).
    let candidates: SabmailMessageRow[] = [];
    if (term) {
      const res = await searchSabmailMessages(accountId, 'INBOX', term);
      if (!res.ok) return { ok: false, error: res.error };
      candidates = res.messages;
    } else {
      // Age-only rule: scan the most-recent inbox page.
      const res = await listSabmailMessages(accountId, 'INBOX', 0, 80);
      if (!res.ok) return { ok: false, error: res.error };
      candidates = res.messages;
    }

    const now = new Date();
    const matched = candidates.filter((m) =>
      matchesSabmailRule(
        compiled,
        {
          fromName: m.fromName,
          fromEmail: m.fromEmail,
          subject: m.subject,
          date: m.date,
        },
        now,
      ),
    );

    const sample: SabmailRulePreviewSample[] = matched.slice(0, 8).map((m) => ({
      uid: m.uid,
      subject: m.subject,
      fromName: m.fromName,
      fromEmail: m.fromEmail,
      date: m.date,
    }));

    return { ok: true, count: matched.length, scanned: candidates.length, sample };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
