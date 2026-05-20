import { NextResponse, type NextRequest } from 'next/server';

/**
 * Provider webhook proxy.
 *
 * Carriers (Twilio, Vonage, …) POST inbound messages and DLR events to
 * `/api/sabsms/webhook/<provider>/<inbound|dlr>`. Next.js intentionally
 * doesn't parse them — it forwards the raw body and signature header to
 * the Rust engine, which owns the verification + idempotency logic.
 *
 * Keeping the parser in Rust means we don't accidentally drift between
 * Next-side and engine-side verification, and Next stays out of the hot
 * path (the engine writes the message doc and fires the conversation
 * event in one transaction).
 */

const SUPPORTED_PROVIDERS = new Set([
  'twilio',
  'vonage',
  'messagebird',
  'plivo',
  'sinch',
  'infobip',
  'aws_sns',
  'telnyx',
  'msg91',
  'gupshup',
  'textlocal',
  'kaleyra',
  'karix',
]);

const SUPPORTED_DIRECTIONS = new Set(['inbound', 'dlr']);

function getEngineBaseUrl(): string {
  return (process.env.SABSMS_ENGINE_URL ?? 'http://localhost:4002').replace(/\/+$/, '');
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ provider: string; direction: string }> },
) {
  const { provider, direction } = await context.params;

  if (!SUPPORTED_PROVIDERS.has(provider) || !SUPPORTED_DIRECTIONS.has(direction)) {
    return NextResponse.json({ error: 'unknown_provider_or_direction' }, { status: 404 });
  }

  if ((process.env.SABSMS_ENABLED ?? 'false').toLowerCase() !== 'true') {
    return NextResponse.json({ error: 'engine_disabled' }, { status: 503 });
  }

  // Forward raw body + every header — Rust validates the provider
  // signature against the raw bytes, so we must not re-serialize.
  const rawBody = await req.text();
  const forwardHeaders: Record<string, string> = {
    'X-Sabsms-Service-Token': process.env.SABSMS_ENGINE_TOKEN ?? '',
    'X-Sabsms-Forwarded-Provider': provider,
    'X-Sabsms-Forwarded-Direction': direction,
  };
  for (const [key, value] of req.headers.entries()) {
    // Drop hop-by-hop + host headers; pass everything else through so
    // provider signature headers survive.
    const lowered = key.toLowerCase();
    if (
      lowered === 'host' ||
      lowered === 'connection' ||
      lowered === 'content-length' ||
      lowered.startsWith('x-sabsms-')
    ) {
      continue;
    }
    forwardHeaders[key] = value;
  }

  const url = `${getEngineBaseUrl()}/webhook/${provider}/${direction}`;

  try {
    const engineRes = await fetch(url, {
      method: 'POST',
      headers: forwardHeaders,
      body: rawBody,
    });
    const contentType = engineRes.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json')
      ? await engineRes.json().catch(() => null)
      : await engineRes.text().catch(() => '');
    return new NextResponse(
      typeof payload === 'string' ? payload : JSON.stringify(payload ?? {}),
      {
        status: engineRes.status,
        headers: { 'content-type': contentType || 'application/json' },
      },
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: 'engine_unreachable', detail: e?.message ?? 'unknown' },
      { status: 502 },
    );
  }
}

// Some carriers send a GET to verify the endpoint before enabling it
// (Twilio doesn't, Telnyx does). Echo a 200 so the verification passes.
export async function GET() {
  return new NextResponse('ok', { status: 200 });
}
