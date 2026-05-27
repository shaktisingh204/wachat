/**
 * Public form-submission endpoint.
 *
 * POST `/api/sabtables/forms/[formToken]` with `{ fieldsJson: {...} }`.
 * Resolves the form view via the Rust BFF and inserts a record into
 * the owning table. Auth is intentionally public — the form token is
 * the only secret.
 *
 * NOTE: this calls `rustFetch`, which mints a service-tier JWT, so the
 * insert is performed as the form-owner. Wire a stricter scope (or a
 * dedicated "form_submitter" identity) before going to production.
 */

import { NextResponse } from 'next/server';

import { sabtablesViewsApi } from '@/lib/rust-client/sabtables-views';
import { sabtablesRecordsApi } from '@/lib/rust-client/sabtables-records';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ formToken: string }> },
) {
  const { formToken } = await params;
  let body: { fieldsJson?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!body.fieldsJson || typeof body.fieldsJson !== 'object') {
    return NextResponse.json({ error: 'fieldsJson required' }, { status: 400 });
  }
  try {
    const view = await sabtablesViewsApi.getByFormToken(formToken);
    const res = await sabtablesRecordsApi.create({
      tableId: view.tableId,
      fieldsJson: body.fieldsJson,
    });
    return NextResponse.json({ id: res.id, ok: true });
  } catch (err) {
    console.error('[sabtables-forms] submit failed', err);
    return NextResponse.json({ error: 'submission failed' }, { status: 500 });
  }
}
