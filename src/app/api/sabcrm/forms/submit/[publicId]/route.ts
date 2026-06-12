/**
 * PUBLIC SabCRM form submit endpoint (CORS-open, unauthenticated).
 *
 * The cross-origin twin of the in-app server action — external sites that
 * embed a SabCRM form POST here, exactly like the legacy
 * `/api/crm/forms/submit/[formId]` route. All validation, honeypot,
 * rate limiting, and the Rust call (which resolves the tenant FROM THE
 * FORM DOCUMENT and dispatches the HMAC-signed webhook) live in
 * `submitSabcrmPublicForm`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { submitSabcrmPublicForm } from '@/app/actions/sabcrm-forms-public.actions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ publicId: string }> },
): Promise<NextResponse> {
  const { publicId } = await props.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body.' },
      { status: 400, headers: corsHeaders },
    );
  }

  // Accept both `{ data: {...} }` envelopes and bare field blobs.
  const data =
    body && typeof body.data === 'object' && body.data !== null
      ? (body.data as Record<string, unknown>)
      : body;

  const result = await submitSabcrmPublicForm(
    publicId,
    data ?? {},
    request.headers.get('origin') ?? undefined,
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: 400, headers: corsHeaders },
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: result.message,
      redirectUrl: result.redirectUrl,
    },
    { headers: corsHeaders },
  );
}

// Handle preflight requests for CORS.
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
