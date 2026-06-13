/**
 * PUBLIC POST /api/sabmail/forms/<id>/submit
 *
 * The no-auth on-ramp for a SabMail form. There is NO session/cookie here, so
 * the workspace is derived from the FORM document (loaded by `id`) — never from
 * `getSabmailWorkspaceId()`.
 *
 * Flow:
 *   1. Load the form by `id` → read its `workspaceId`.
 *   2. Parse the body (JSON or url-encoded / multipart form-encoded).
 *   3. Require an email field → upsert a contact into the workspace's
 *      `contacts` collection (matched on {workspaceId, email}), tagging it with
 *      the form's `tag` when set.
 *   4. Record a `form_submit` event.
 *   5. Return `{ ok: true }` — or 302-redirect to the form's `redirectUrl`.
 *
 * CORS-friendly: allows cross-origin POST (forms embed on any site) + OPTIONS
 * preflight. Defensive parsing throughout — a malformed body never 500s past
 * the documented 400.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SabmailFormDoc {
  _id: ObjectId;
  workspaceId: string;
  name?: string;
  fields?: Array<{ key?: string; label?: string; type?: string }>;
  tag?: string;
  redirectUrl?: string;
}

/** Read the request body as a flat string-keyed map (JSON or form-encoded). */
async function parseBody(req: NextRequest): Promise<Record<string, string>> {
  const contentType = (req.headers.get('content-type') ?? '').toLowerCase();
  const out: Record<string, string> = {};

  try {
    if (contentType.includes('application/json')) {
      const json = (await req.json()) as unknown;
      if (json && typeof json === 'object') {
        for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
          if (v == null) continue;
          out[String(k)] = typeof v === 'string' ? v : String(v);
        }
      }
      return out;
    }

    // url-encoded OR multipart form-encoded — both handled by req.formData().
    const form = await req.formData();
    for (const [k, v] of form.entries()) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    // Last-resort: try to read the raw body as url-encoded text.
    try {
      const text = await req.text();
      if (text) {
        const params = new URLSearchParams(text);
        for (const [k, v] of params.entries()) out[k] = v;
      }
    } catch {
      /* give up — return whatever we have */
    }
    return out;
  }
}

/** Find the first email-looking value among the submitted fields. */
function pickEmail(body: Record<string, string>): string | null {
  // Prefer common email keys first.
  for (const key of ['email', 'e-mail', 'email_address', 'emailAddress']) {
    const v = body[key]?.trim().toLowerCase();
    if (v && EMAIL_RE.test(v)) return v;
  }
  // Then any key whose name contains "email".
  for (const [k, raw] of Object.entries(body)) {
    if (k.toLowerCase().includes('email')) {
      const v = raw.trim().toLowerCase();
      if (v && EMAIL_RE.test(v)) return v;
    }
  }
  // Finally any value that looks like an email.
  for (const raw of Object.values(body)) {
    const v = raw.trim().toLowerCase();
    if (v && EMAIL_RE.test(v)) return v;
  }
  return null;
}

/** Find a name-ish value among the submitted fields. */
function pickName(body: Record<string, string>): string | undefined {
  for (const key of ['name', 'full_name', 'fullName', 'fullname', 'first_name', 'firstName']) {
    const v = body[key]?.trim();
    if (v) return v.slice(0, 200);
  }
  for (const [k, raw] of Object.entries(body)) {
    if (k.toLowerCase().includes('name')) {
      const v = raw.trim();
      if (v) return v.slice(0, 200);
    }
  }
  return undefined;
}

async function handle(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await props.params;
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, error: 'Form not found.' }, { status: 404, headers: corsHeaders });
    }

    const { db } = await connectToDatabase();
    const form = (await db
      .collection(SABMAIL_COLLECTIONS.forms)
      .findOne({ _id: new ObjectId(id) })) as SabmailFormDoc | null;

    if (!form || !form.workspaceId) {
      return NextResponse.json({ ok: false, error: 'Form not found.' }, { status: 404, headers: corsHeaders });
    }
    const workspaceId = String(form.workspaceId);

    const body = await parseBody(req);
    const email = pickEmail(body);
    if (!email) {
      return NextResponse.json(
        { ok: false, error: 'A valid email is required.' },
        { status: 400, headers: corsHeaders },
      );
    }

    const name = pickName(body);
    const tag = typeof form.tag === 'string' ? form.tag.trim() : '';

    const now = new Date();

    // Upsert the contact on {workspaceId, email}.
    const set: Record<string, unknown> = {};
    if (name) set.name = name;
    const update: Record<string, unknown> = {
      ...(Object.keys(set).length ? { $set: set } : {}),
      $setOnInsert: { workspaceId, email, createdAt: now },
    };
    if (tag) {
      (update as { $addToSet?: unknown }).$addToSet = { tags: tag };
    } else {
      (update as { $setOnInsert: Record<string, unknown> }).$setOnInsert.tags = [];
    }

    await db
      .collection(SABMAIL_COLLECTIONS.contacts)
      .updateOne({ workspaceId, email }, update as never, { upsert: true });

    // Record the submission event (best-effort — non-fatal if it fails).
    try {
      await db.collection(SABMAIL_COLLECTIONS.events).insertOne({
        workspaceId,
        event: 'form_submit',
        formId: id,
        email,
        ts: now,
      } as never);
    } catch (e) {
      console.error('[sabmail] form_submit event insert failed:', getErrorMessage(e));
    }

    // Redirect when the form configured one (browser-friendly thank-you page).
    const redirectUrl = typeof form.redirectUrl === 'string' ? form.redirectUrl.trim() : '';
    if (redirectUrl && /^https?:\/\//i.test(redirectUrl)) {
      return NextResponse.redirect(redirectUrl, { status: 302, headers: corsHeaders });
    }

    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch (e) {
    console.error('[sabmail] form submit error:', e);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(e) },
      { status: 500, headers: corsHeaders },
    );
  }
}

export const POST = handle;

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
