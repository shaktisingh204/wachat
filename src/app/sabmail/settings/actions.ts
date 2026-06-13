'use server';

import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail Settings — one doc per workspace (`sabmail_settings`), upserted.
 *
 * The shared `SabmailSettings` type doesn't yet carry `signatureHtml`, so
 * this surface uses its own structural shape (a superset) against the raw
 * collection — keeping the file self-contained and not touching shared code.
 * The signature HTML is sanitized server-side (sanitize-html dynamic import)
 * before it's ever stored.
 * ──────────────────────────────────────────────────────────────────── */

export interface SabmailSettingsDoc {
  defaultFromAccountId: string | null;
  signatureHtml: string | null;
  blockRemoteImages: boolean;
  updatedAt: string | null;
}

export interface SaveSabmailSettingsInput {
  defaultFromAccountId?: string | null;
  signatureHtml?: string | null;
  blockRemoteImages?: boolean;
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Internal Mongo shape (superset of the shared SabmailSettings type). */
interface SabmailSettingsRow {
  workspaceId: string;
  defaultFromAccountId?: string;
  signatureHtml?: string;
  blockRemoteImages?: boolean;
  updatedAt: Date;
}

/** Sanitize the signature HTML: strip scripts/handlers, keep light formatting. */
async function sanitizeSignatureHtml(html: string): Promise<string> {
  const mod = (await import('sanitize-html')) as unknown as {
    default?: (html: string, opts: unknown) => string;
  } & ((html: string, opts: unknown) => string);
  const sanitizeHtml = mod.default ?? mod;
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 's',
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
  });
}

function toSettingsDoc(row: SabmailSettingsRow | null): SabmailSettingsDoc {
  if (!row) {
    return {
      defaultFromAccountId: null,
      signatureHtml: null,
      blockRemoteImages: true,
      updatedAt: null,
    };
  }
  return {
    defaultFromAccountId: row.defaultFromAccountId ?? null,
    signatureHtml: row.signatureHtml ?? null,
    blockRemoteImages: row.blockRemoteImages ?? true,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/** Read the per-workspace settings doc (with safe defaults when unset). */
export async function getSabmailSettings(): Promise<Result<{ settings: SabmailSettingsDoc }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  try {
    const { db } = await connectToDatabase();
    const row = (await db
      .collection(SABMAIL_COLLECTIONS.settings)
      .findOne({ workspaceId })) as unknown as SabmailSettingsRow | null;
    return { ok: true, settings: toSettingsDoc(row) };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/** Upsert the per-workspace settings doc (signature HTML sanitized first). */
export async function saveSabmailSettings(
  input: SaveSabmailSettingsInput,
): Promise<Result<{ settings: SabmailSettingsDoc }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  try {
    const now = new Date();
    const set: Record<string, unknown> = { updatedAt: now };
    const unset: Record<string, ''> = {};

    if (input.defaultFromAccountId !== undefined) {
      const id = (input.defaultFromAccountId ?? '').trim();
      if (id) set.defaultFromAccountId = id;
      else unset.defaultFromAccountId = '';
    }

    if (input.signatureHtml !== undefined) {
      const raw = (input.signatureHtml ?? '').trim();
      if (raw) set.signatureHtml = await sanitizeSignatureHtml(raw);
      else unset.signatureHtml = '';
    }

    if (input.blockRemoteImages !== undefined) {
      set.blockRemoteImages = !!input.blockRemoteImages;
    }

    const update: Record<string, unknown> = {
      $set: set,
      $setOnInsert: { workspaceId },
    };
    if (Object.keys(unset).length > 0) update.$unset = unset;

    const { db } = await connectToDatabase();
    await db
      .collection(SABMAIL_COLLECTIONS.settings)
      .updateOne({ workspaceId }, update as never, { upsert: true });

    const row = (await db
      .collection(SABMAIL_COLLECTIONS.settings)
      .findOne({ workspaceId })) as unknown as SabmailSettingsRow | null;

    revalidatePath('/sabmail/settings');
    return { ok: true, settings: toSettingsDoc(row) };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
