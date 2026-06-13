import 'server-only';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail — suppression list (`sabmail_suppressions`).
 *
 * A workspace-scoped block list of recipient addresses we must never email
 * again: hard/permanent bounces, complaints (spam reports), and dropped
 * sends. Written by the deliverability webhook ingestion route and (later)
 * read at send time before every dispatch.
 *
 * This module is deliberately NOT a `'use server'` action file: it is called
 * from the webhook route (which has no session/cookie) and operates across
 * workspaces using the explicit `workspaceId` carried on each record. The
 * caller supplies the tenant key — `getSabmailWorkspaceId()` is NEVER used
 * here (webhook context). Mirrors the `sabsms_suppressions` convention.
 * ──────────────────────────────────────────────────────────────────── */

/** Why an address was suppressed. */
export type SabmailSuppressionReason =
  | 'bounce'
  | 'complaint'
  | 'unsubscribe'
  | 'manual';

/** Where the suppression originated. */
export type SabmailSuppressionSource = 'webhook' | 'manual' | 'import' | 'api';

/** The stored shape of one suppression entry (one Mongo doc). */
export interface SabmailSuppressionDoc {
  workspaceId: string;
  /** Lowercased recipient address — the dedupe key (per workspace). */
  email: string;
  reason: SabmailSuppressionReason;
  source: SabmailSuppressionSource;
  /** Provider name when the suppression came from a deliverability event. */
  provider?: string;
  /** Provider message id tied to the suppressing event, when known. */
  messageId?: string;
  /** Provider-native event id (dedupe id) for the suppressing event. */
  dedupeId?: string;
  /** Free-text detail (bounce reason / diagnostic), when available. */
  detail?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddSabmailSuppressionInput {
  workspaceId: string;
  email: string;
  reason: SabmailSuppressionReason;
  source?: SabmailSuppressionSource;
  provider?: string;
  messageId?: string;
  dedupeId?: string;
  detail?: string;
}

export type AddSabmailSuppressionResult =
  | { ok: true; created: boolean }
  | { ok: false; error: string };

/** Normalise an address to its canonical (lowercased, trimmed) form. */
export function normalizeSuppressionEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

/**
 * Idempotently add (or refresh) a suppression for `email` within
 * `workspaceId`. Safe to call repeatedly — webhooks are at-least-once, so
 * this upserts on `{ workspaceId, email }` and never throws.
 *
 * Two call styles are supported:
 *   - the rich object form used by deliverability-webhook ingestion, which
 *     returns `{ ok: true, created }` (so the caller can tell new from refresh);
 *   - the positional form `(workspaceId, email, reason, source)` used by the
 *     Suppressions surface / manual adds, which resolves to `void`.
 */
export async function addSabmailSuppression(
  input: AddSabmailSuppressionInput,
): Promise<AddSabmailSuppressionResult>;
export async function addSabmailSuppression(
  workspaceId: string,
  email: string,
  reason?: SabmailSuppressionReason,
  source?: SabmailSuppressionSource,
): Promise<void>;
export async function addSabmailSuppression(
  inputOrWorkspaceId: AddSabmailSuppressionInput | string,
  emailArg?: string,
  reasonArg?: SabmailSuppressionReason,
  sourceArg?: SabmailSuppressionSource,
): Promise<AddSabmailSuppressionResult | void> {
  const positional = typeof inputOrWorkspaceId === 'string';
  const input: AddSabmailSuppressionInput = positional
    ? {
        workspaceId: inputOrWorkspaceId,
        email: emailArg ?? '',
        reason: reasonArg ?? 'manual',
        source: sourceArg ?? 'manual',
      }
    : inputOrWorkspaceId;

  const result = await addSuppressionDoc(input);
  // Positional callers expect `void` (fire-and-forget upsert).
  if (positional) return;
  return result;
}

/** Core upsert shared by both `addSabmailSuppression` call styles. */
async function addSuppressionDoc(
  input: AddSabmailSuppressionInput,
): Promise<AddSabmailSuppressionResult> {
  const workspaceId = String(input.workspaceId ?? '').trim();
  const email = normalizeSuppressionEmail(input.email);
  if (!workspaceId) return { ok: false, error: 'Missing workspaceId.' };
  if (!email) return { ok: false, error: 'Missing email.' };

  try {
    const { db } = await connectToDatabase();
    const col = db.collection(SABMAIL_COLLECTIONS.suppressions);

    // Idempotent dedupe index (best-effort; safe to call repeatedly).
    await col
      .createIndex({ workspaceId: 1, email: 1 }, { unique: true })
      .catch(() => undefined);

    const now = new Date();
    const set: Partial<SabmailSuppressionDoc> = {
      reason: input.reason,
      source: input.source ?? 'webhook',
      updatedAt: now,
    };
    if (input.provider) set.provider = input.provider;
    if (input.messageId) set.messageId = input.messageId;
    if (input.dedupeId) set.dedupeId = input.dedupeId;
    if (input.detail) set.detail = input.detail;

    const res = await col.updateOne(
      { workspaceId, email },
      {
        $set: set,
        $setOnInsert: { workspaceId, email, createdAt: now },
      },
      { upsert: true },
    );

    return { ok: true, created: (res.upsertedCount ?? 0) > 0 };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

/**
 * True if `email` is suppressed for `workspaceId`. Read this before every
 * send. Never throws — a lookup failure returns `false` (fail-open is the
 * lesser harm for a missing index/connection, and sends still go through
 * the provider's own suppression as a backstop).
 */
export async function isSabmailSuppressed(
  workspaceId: string,
  email: string,
): Promise<boolean> {
  const ws = String(workspaceId ?? '').trim();
  const addr = normalizeSuppressionEmail(email);
  if (!ws || !addr) return false;
  try {
    const { db } = await connectToDatabase();
    const col = db.collection(SABMAIL_COLLECTIONS.suppressions);
    const hit = await col.findOne(
      { workspaceId: ws, email: addr },
      { projection: { _id: 1 } },
    );
    return Boolean(hit);
  } catch {
    return false;
  }
}

/**
 * Remove an address from the workspace's suppression list (re-enable sending).
 * No-op when the address isn't suppressed. Never throws.
 */
export async function removeSabmailSuppression(
  workspaceId: string,
  email: string,
): Promise<void> {
  const ws = String(workspaceId ?? '').trim();
  const addr = normalizeSuppressionEmail(email);
  if (!ws || !addr) return;
  try {
    const { db } = await connectToDatabase();
    await db
      .collection(SABMAIL_COLLECTIONS.suppressions)
      .deleteOne({ workspaceId: ws, email: addr });
  } catch {
    /* connection/index failure — non-fatal; the next attempt can retry */
  }
}

/** Serialisable projection of one suppression (no `_id`, no `workspaceId`). */
export interface SabmailSuppressionRaw {
  email: string;
  reason: SabmailSuppressionReason;
  source: SabmailSuppressionSource;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/**
 * List the workspace's suppressions (newest first) as serialisable rows —
 * the projection the Suppressions surface renders. Never throws; returns an
 * empty list on failure.
 */
export async function listSabmailSuppressionsRaw(
  workspaceId: string,
): Promise<SabmailSuppressionRaw[]> {
  const ws = String(workspaceId ?? '').trim();
  if (!ws) return [];
  try {
    const { db } = await connectToDatabase();
    const docs = await db
      .collection(SABMAIL_COLLECTIONS.suppressions)
      .find({ workspaceId: ws })
      .sort({ createdAt: -1 })
      .limit(2000)
      .toArray();

    return docs.map((d) => {
      const doc = d as unknown as SabmailSuppressionDoc;
      const created =
        doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt);
      return {
        email: doc.email ?? '',
        reason: (doc.reason ?? 'manual') as SabmailSuppressionReason,
        source: (doc.source ?? 'manual') as SabmailSuppressionSource,
        createdAt: Number.isNaN(created.getTime())
          ? new Date(0).toISOString()
          : created.toISOString(),
      };
    });
  } catch {
    return [];
  }
}
