'use server';

import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail — Forms (signup / lead capture).
 *
 * A form is a tiny published schema (a list of fields) that exposes a PUBLIC
 * submit endpoint (`/api/sabmail/forms/<id>/submit`). When someone submits,
 * the public route upserts a contact into `SABMAIL_COLLECTIONS.contacts` and
 * records a `form_submit` event — so a form is the no-auth on-ramp into a
 * workspace's audience.
 *
 * These actions own the AUTHORED side: list / create / delete, every one
 * tenant-scoped by the active SabMail `workspaceId`. The collection is the
 * SabMail roadmap's reserved `forms` name — no schema change to the shared
 * collections module.
 * ──────────────────────────────────────────────────────────────────── */

export type SabmailFormFieldType = 'email' | 'text';

export interface SabmailFormField {
  key: string;
  label: string;
  type: SabmailFormFieldType;
}

/** The stored shape of a form (one Mongo doc). */
export interface SabmailFormDoc {
  workspaceId: string;
  name: string;
  fields: SabmailFormField[];
  tag?: string;
  redirectUrl?: string;
  createdAt: Date;
}

/** Safe, serializable projection sent to the client. */
export interface SabmailFormRow {
  id: string;
  name: string;
  fields: SabmailFormField[];
  tag: string | null;
  redirectUrl: string | null;
  createdAt: string;
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
type VoidResult = { ok: true } | { ok: false; error: string };

const FIELD_TYPES: SabmailFormFieldType[] = ['email', 'text'];

/** Slugify a label into a stable field key (lowercase, [a-z0-9_]). */
function keyFromLabel(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'field'
  );
}

function normalizeFields(raw: unknown): SabmailFormField[] {
  if (!Array.isArray(raw)) return [];
  const out: SabmailFormField[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as { key?: unknown; label?: unknown; type?: unknown };
    const label = String(r.label ?? '').trim();
    if (!label) continue;
    const type: SabmailFormFieldType = FIELD_TYPES.includes(r.type as SabmailFormFieldType)
      ? (r.type as SabmailFormFieldType)
      : 'text';
    let key = String(r.key ?? '').trim() || keyFromLabel(label);
    key = key.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'field';
    // De-dupe keys so multiple "name" fields don't collide.
    let candidate = key;
    let n = 2;
    while (seen.has(candidate)) {
      candidate = `${key}_${n}`;
      n += 1;
    }
    seen.add(candidate);
    out.push({ key: candidate, label, type });
    if (out.length >= 30) break;
  }
  return out;
}

function toRow(doc: WithId<SabmailFormDoc>): SabmailFormRow {
  return {
    id: String(doc._id),
    name: doc.name?.trim() || 'Untitled form',
    fields: Array.isArray(doc.fields) ? doc.fields : [],
    tag: doc.tag?.trim() ? doc.tag.trim() : null,
    redirectUrl: doc.redirectUrl?.trim() ? doc.redirectUrl.trim() : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date(0).toISOString(),
  };
}

/* ── actions ─────────────────────────────────────────────────────────── */

/** List forms for the active workspace (newest first). */
export async function listSabmailForms(): Promise<SabmailFormRow[]> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return [];

    const { db } = await connectToDatabase();
    const docs = await db
      .collection<SabmailFormDoc>(SABMAIL_COLLECTIONS.forms)
      .find({ workspaceId })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    return docs.map((d) => toRow(d as WithId<SabmailFormDoc>));
  } catch (err) {
    console.error('[sabmail] listSabmailForms failed:', err);
    return [];
  }
}

/** Create a form for the active workspace. */
export async function createSabmailForm(input: {
  name: string;
  fields: SabmailFormField[];
  tag?: string;
  redirectUrl?: string;
}): Promise<Result<{ form: SabmailFormRow }>> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

    const name = input.name?.trim();
    if (!name) return { ok: false, error: 'Give your form a name.' };

    const fields = normalizeFields(input.fields);
    if (fields.length === 0) return { ok: false, error: 'Add at least one field.' };
    if (!fields.some((f) => f.type === 'email')) {
      return { ok: false, error: 'Add an email field so submissions become contacts.' };
    }

    const tag = input.tag?.trim();
    const redirectUrl = input.redirectUrl?.trim();
    if (redirectUrl && !/^https?:\/\//i.test(redirectUrl)) {
      return { ok: false, error: 'Redirect URL must start with http:// or https://.' };
    }

    const doc: SabmailFormDoc = {
      workspaceId,
      name,
      fields,
      ...(tag ? { tag } : {}),
      ...(redirectUrl ? { redirectUrl } : {}),
      createdAt: new Date(),
    };

    const { db } = await connectToDatabase();
    const res = await db
      .collection<SabmailFormDoc>(SABMAIL_COLLECTIONS.forms)
      .insertOne(doc as never);

    return {
      ok: true,
      form: toRow({ ...doc, _id: res.insertedId } as WithId<SabmailFormDoc>),
    };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/** Delete a form for the active workspace. */
export async function deleteSabmailForm(id: string): Promise<VoidResult> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
    if (!id || !ObjectId.isValid(id)) return { ok: false, error: 'Invalid form id.' };

    const { db } = await connectToDatabase();
    const res = await db
      .collection<SabmailFormDoc>(SABMAIL_COLLECTIONS.forms)
      .deleteOne({ _id: new ObjectId(id), workspaceId });

    if (res.deletedCount === 0) return { ok: false, error: 'Form not found.' };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}
