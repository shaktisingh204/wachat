'use server';

import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail contacts — the audience/address-book surface.
 *
 * Stored in `SABMAIL_COLLECTIONS.contacts`, scoped by `workspaceId` (the
 * `kind:'mail'` project `_id` string). Identity is the {workspaceId, email}
 * pair: every write upserts on that pair, so re-imports and re-adds are
 * idempotent without requiring a unique index to exist up front.
 * ──────────────────────────────────────────────────────────────────── */

export interface SabmailContact {
  _id: ObjectId;
  workspaceId: string;
  email: string;
  name?: string;
  tags?: string[];
  createdAt: Date;
}

/** Safe, serializable projection for the client. */
export interface SabmailContactRow {
  id: string;
  email: string;
  name: string | null;
  tags: string[];
  createdAt: string;
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return null;
  return email;
}

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const t of raw) {
    const tag = String(t ?? '').trim();
    if (tag) seen.add(tag);
  }
  return Array.from(seen).slice(0, 50);
}

function toRow(doc: WithId<SabmailContact>): SabmailContactRow {
  return {
    id: String(doc._id),
    email: doc.email,
    name: doc.name?.trim() ? doc.name.trim() : null,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date(0).toISOString(),
  };
}

/* ── list ─────────────────────────────────────────────────────────────── */

export async function listSabmailContacts(): Promise<SabmailContactRow[]> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return [];

    const { db } = await connectToDatabase();
    const docs = await db
      .collection<SabmailContact>(SABMAIL_COLLECTIONS.contacts)
      .find({ workspaceId })
      .sort({ createdAt: -1 })
      .limit(2000)
      .toArray();

    return docs.map((d) => toRow(d as WithId<SabmailContact>));
  } catch (err) {
    console.error('[sabmail] listSabmailContacts failed:', err);
    return [];
  }
}

/* ── create (upsert on {workspaceId, email}) ──────────────────────────── */

export async function createSabmailContact(input: {
  email: string;
  name?: string;
  tags?: string[];
}): Promise<Result<{ contact: SabmailContactRow }>> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

    const email = normalizeEmail(input.email);
    if (!email) return { ok: false, error: 'Enter a valid email address.' };

    const name = input.name?.trim();
    const tags = normalizeTags(input.tags);
    const now = new Date();

    const set: Record<string, unknown> = {};
    if (name) set.name = name;
    if (tags.length) set.tags = tags;

    const { db } = await connectToDatabase();
    const col = db.collection<SabmailContact>(SABMAIL_COLLECTIONS.contacts);

    await col.updateOne(
      { workspaceId, email },
      {
        ...(Object.keys(set).length ? { $set: set } : {}),
        $setOnInsert: { workspaceId, email, createdAt: now },
      } as never,
      { upsert: true },
    );

    const doc = await col.findOne({ workspaceId, email });
    if (!doc) return { ok: false, error: 'Could not save the contact.' };
    return { ok: true, contact: toRow(doc as WithId<SabmailContact>) };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── delete ───────────────────────────────────────────────────────────── */

export async function deleteSabmailContact(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
    if (!id || !ObjectId.isValid(id)) return { ok: false, error: 'Invalid contact id.' };

    const { db } = await connectToDatabase();
    await db
      .collection<SabmailContact>(SABMAIL_COLLECTIONS.contacts)
      .deleteOne({ _id: new ObjectId(id), workspaceId });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── bulk import (upsert each row on {workspaceId, email}) ─────────────── */

export async function importSabmailContacts(
  rows: { email: string; name?: string }[],
): Promise<Result<{ imported: number; skipped: number }>> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: 'No rows to import.' };
    }

    const now = new Date();
    // Dedupe by normalized email; keep the first non-empty name seen.
    const byEmail = new Map<string, string | undefined>();
    let skipped = 0;
    for (const row of rows) {
      const email = normalizeEmail(row?.email);
      if (!email) {
        skipped += 1;
        continue;
      }
      const name = String(row?.name ?? '').trim() || undefined;
      const existing = byEmail.get(email);
      if (existing === undefined) byEmail.set(email, name);
      else if (!existing && name) byEmail.set(email, name);
    }

    if (byEmail.size === 0) {
      return { ok: false, error: 'No valid email addresses found.' };
    }

    const { db } = await connectToDatabase();
    const col = db.collection<SabmailContact>(SABMAIL_COLLECTIONS.contacts);

    const ops = Array.from(byEmail.entries()).map(([email, name]) => ({
      updateOne: {
        filter: { workspaceId, email },
        update: {
          ...(name ? { $set: { name } } : {}),
          $setOnInsert: { workspaceId, email, createdAt: now },
        },
        upsert: true,
      },
    }));

    await col.bulkWrite(ops as never, { ordered: false });
    return { ok: true, imported: byEmail.size, skipped };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}
