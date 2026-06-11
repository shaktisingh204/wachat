'use server';

/**
 * SabSheet Forms — PUBLIC submit action.
 *
 * Intentionally UNAUTHENTICATED: this is invoked from the public form page
 * (`/sabsheet/form/:token`) which has no session. It re-resolves the form by
 * its opaque token from Mongo, validates required fields, then appends a new
 * row to the form's sheet via the Rust ops endpoint — acting as the form's
 * OWNER (`rustFetchAs(ownerUserId, …)`), exactly like the SabPay public API
 * acts as a merchant. The browser never sees the owner id or a JWT.
 *
 * A row is appended at the form's atomically-incremented `nextRow`, writing
 * each field's value into `setCell(sheetIndex, nextRow, columnIndex)`.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { rustFetchAs } from '@/lib/rust-client/fetcher';
import { cmd, type Command } from '@/lib/sabsheet/commands/ops';
import {
  COLL_SABSHEET_FORMS,
  type SabsheetFormField,
} from '@/lib/sabsheet/forms/types';

export type SubmitFormResult = { ok: true } | { error: string };

/** Naive in-process rate limiter — best-effort, per server instance. */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function validateValue(field: SabsheetFormField, raw: string | undefined): string | null {
  const value = (raw ?? '').trim();
  if (field.required && !value) {
    return `${field.label} is required`;
  }
  if (!value) return null;
  if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return `${field.label} must be a valid email`;
  }
  if (field.type === 'number' && Number.isNaN(Number(value))) {
    return `${field.label} must be a number`;
  }
  if (field.type === 'select' && field.options && field.options.length > 0) {
    if (!field.options.includes(value)) {
      return `${field.label} has an invalid choice`;
    }
  }
  return null;
}

/**
 * Append a row to the form's sheet from a public submission.
 *
 * @param token   The form's public token.
 * @param values  Map keyed by the field's `columnIndex` (as a string) →
 *                submitted value. A `_hp` honeypot key (must be empty) is
 *                consumed for bot detection.
 */
export async function submitForm(
  token: string,
  values: Record<string, string>,
): Promise<SubmitFormResult> {
  if (!token || typeof token !== 'string') return { error: 'Invalid form.' };

  // Honeypot: a hidden field bots tend to fill. Real users leave it empty.
  if (values && typeof values._hp === 'string' && values._hp.trim() !== '') {
    // Silently accept to avoid signalling the trap to bots.
    return { ok: true };
  }

  if (rateLimited(token)) {
    return { error: 'Too many submissions. Please try again shortly.' };
  }

  const { db } = await connectToDatabase();
  const form = await db
    .collection(COLL_SABSHEET_FORMS)
    .findOne({ token });
  if (!form) return { error: 'This form no longer exists.' };
  if (form.status === 'closed') {
    return { error: 'This form is closed and no longer accepting responses.' };
  }

  const fields: SabsheetFormField[] = Array.isArray(form.fields) ? form.fields : [];

  // Validate every field.
  for (const field of fields) {
    const err = validateValue(field, values?.[String(field.columnIndex)]);
    if (err) return { error: err };
  }

  // Resolve the target sheet's 0-based index (IronCalc sheet index ==
  // the sheet doc's `position`).
  let sheetOid: ObjectId;
  let wbOid: ObjectId;
  try {
    sheetOid = new ObjectId(String(form.sheetId));
    wbOid = new ObjectId(String(form.workbookId));
  } catch {
    return { error: 'Form is misconfigured.' };
  }
  const sheet = await db
    .collection('sabsheet_sheets')
    .findOne({ _id: sheetOid, workbookId: wbOid });
  if (!sheet) return { error: 'Form target sheet not found.' };
  const sheetIndex = Number(sheet.position ?? 0);

  // Atomically claim a unique row for this submission.
  const claimed = await db
    .collection(COLL_SABSHEET_FORMS)
    .findOneAndUpdate(
      { _id: form._id },
      { $inc: { nextRow: 1, submitCount: 1 }, $set: { updatedAt: new Date() } },
      { returnDocument: 'before' },
    );
  const targetRow = Number((claimed as any)?.nextRow ?? form.nextRow ?? 2);

  // Build setCell commands for every field that has a value.
  const commands: Command[] = [];
  for (const field of fields) {
    const value = (values?.[String(field.columnIndex)] ?? '').trim();
    if (!value) continue;
    // columnIndex is 0-based; IronCalc setCell uses 1-based columns.
    commands.push(cmd.setCell(sheetIndex, targetRow, field.columnIndex + 1, value));
  }

  if (commands.length === 0) {
    // Nothing to write (all-optional form submitted blank) — still a success.
    return { ok: true };
  }

  try {
    await rustFetchAs(String(form.ownerUserId), '/v1/sabsheet/ops', {
      method: 'POST',
      body: JSON.stringify({
        workbookId: String(form.workbookId),
        commands,
        origin: 'form',
      }),
    });
  } catch {
    // Roll back the optimistic submitCount on a write failure (best-effort).
    await db
      .collection(COLL_SABSHEET_FORMS)
      .updateOne({ _id: form._id }, { $inc: { submitCount: -1 } });
    return { error: 'Could not record your response. Please try again.' };
  }

  return { ok: true };
}
