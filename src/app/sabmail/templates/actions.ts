'use server';

import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail templates — reusable subject + rich-HTML bodies, scoped per
 * workspace (the `kind:'mail'` project `_id` string).
 *
 * Every body is sanitized server-side with `sanitize-html` before it's
 * stored, so a template can never carry scripts / event handlers into a
 * composed message.
 * ──────────────────────────────────────────────────────────────────── */

/** Stored shape of a template document. */
interface SabmailTemplateDoc {
  _id: ObjectId;
  workspaceId: string;
  name: string;
  subject: string;
  bodyHtml: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Client-safe (serializable) projection of a template. */
export interface SabmailTemplateRow {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  createdAt: string;
  updatedAt: string;
}

export interface SabmailTemplateInput {
  name: string;
  subject: string;
  bodyHtml: string;
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
type VoidResult = { ok: true } | { ok: false; error: string };

function toRow(doc: WithId<SabmailTemplateDoc>): SabmailTemplateRow {
  return {
    id: String(doc._id),
    name: doc.name,
    subject: doc.subject ?? '',
    bodyHtml: doc.bodyHtml ?? '',
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date(0).toISOString(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date(0).toISOString(),
  };
}

/** Sanitize a stored template body: strip scripts/handlers, keep formatting + images. */
async function sanitizeTemplateHtml(html: string): Promise<string> {
  const mod = (await import('sanitize-html')) as any;
  const sanitizeHtml = mod.default ?? mod;
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup',
      'a', 'img', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'h1', 'h2', 'h3', 'h4', 'hr', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'font',
    ],
    allowedAttributes: {
      '*': ['style', 'align', 'dir'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'style'],
      font: ['face', 'size', 'color'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'cid', 'data', 'tel'],
  }) as string;
}

/* ── read ─────────────────────────────────────────────────────────────── */

export async function listSabmailTemplates(): Promise<SabmailTemplateRow[]> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return [];
    const { db } = await connectToDatabase();
    const docs = await db
      .collection<SabmailTemplateDoc>(SABMAIL_COLLECTIONS.templates)
      .find({ workspaceId })
      .sort({ updatedAt: -1 })
      .limit(200)
      .toArray();
    return docs.map((d) => toRow(d as WithId<SabmailTemplateDoc>));
  } catch (err) {
    console.error('[sabmail] listSabmailTemplates failed:', err);
    return [];
  }
}

export async function getSabmailTemplate(
  id: string,
): Promise<Result<{ template: SabmailTemplateRow }>> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
    if (!id || !ObjectId.isValid(id)) return { ok: false, error: 'Invalid template id.' };
    const { db } = await connectToDatabase();
    const doc = await db
      .collection<SabmailTemplateDoc>(SABMAIL_COLLECTIONS.templates)
      .findOne({ _id: new ObjectId(id), workspaceId });
    if (!doc) return { ok: false, error: 'Template not found.' };
    return { ok: true, template: toRow(doc as WithId<SabmailTemplateDoc>) };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── write ────────────────────────────────────────────────────────────── */

export async function createSabmailTemplate(
  input: SabmailTemplateInput,
): Promise<Result<{ template: SabmailTemplateRow }>> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

    const name = input.name?.trim();
    if (!name) return { ok: false, error: 'Template name is required.' };
    if (name.length > 160) return { ok: false, error: 'Template name is too long (max 160 chars).' };
    const subject = input.subject?.trim() ?? '';
    const bodyHtml = await sanitizeTemplateHtml(input.bodyHtml ?? '');

    const { db } = await connectToDatabase();
    const now = new Date();
    const doc: Omit<SabmailTemplateDoc, '_id'> = {
      workspaceId,
      name,
      subject,
      bodyHtml,
      createdAt: now,
      updatedAt: now,
    };
    const ins = await db
      .collection<SabmailTemplateDoc>(SABMAIL_COLLECTIONS.templates)
      .insertOne(doc as SabmailTemplateDoc);

    return {
      ok: true,
      template: toRow({ ...doc, _id: ins.insertedId } as WithId<SabmailTemplateDoc>),
    };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

export async function updateSabmailTemplate(
  id: string,
  input: SabmailTemplateInput,
): Promise<Result<{ template: SabmailTemplateRow }>> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
    if (!id || !ObjectId.isValid(id)) return { ok: false, error: 'Invalid template id.' };

    const name = input.name?.trim();
    if (!name) return { ok: false, error: 'Template name is required.' };
    if (name.length > 160) return { ok: false, error: 'Template name is too long (max 160 chars).' };
    const subject = input.subject?.trim() ?? '';
    const bodyHtml = await sanitizeTemplateHtml(input.bodyHtml ?? '');

    const { db } = await connectToDatabase();
    const now = new Date();
    const res = await db
      .collection<SabmailTemplateDoc>(SABMAIL_COLLECTIONS.templates)
      .findOneAndUpdate(
        { _id: new ObjectId(id), workspaceId },
        { $set: { name, subject, bodyHtml, updatedAt: now } },
        { returnDocument: 'after' },
      );
    if (!res) return { ok: false, error: 'Template not found.' };

    return { ok: true, template: toRow(res as WithId<SabmailTemplateDoc>) };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

export async function deleteSabmailTemplate(id: string): Promise<VoidResult> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
    if (!id || !ObjectId.isValid(id)) return { ok: false, error: 'Invalid template id.' };

    const { db } = await connectToDatabase();
    const res = await db
      .collection<SabmailTemplateDoc>(SABMAIL_COLLECTIONS.templates)
      .deleteOne({ _id: new ObjectId(id), workspaceId });
    if (res.deletedCount === 0) return { ok: false, error: 'Template not found.' };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}
