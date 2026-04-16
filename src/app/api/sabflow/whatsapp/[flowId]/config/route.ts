/**
 * SabFlow — WhatsApp configuration API
 *
 * GET  /api/sabflow/whatsapp/[flowId]/config  → read config (accessToken masked)
 * POST /api/sabflow/whatsapp/[flowId]/config  → upsert config
 *
 * The access token is always persisted encrypted at rest using the shared
 * `credentials/encryption.ts` helper.  Callers never see the plaintext token
 * after it is first submitted — reads return a masked placeholder instead.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { getSabFlowById, getWhatsAppConfig, saveWhatsAppConfig } from '@/lib/sabflow/db';
import { encryptData } from '@/lib/sabflow/credentials/encryption';
import type { WhatsAppConfig } from '@/lib/sabflow/whatsapp/types';

export const dynamic = 'force-dynamic';

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/** Mask pattern used whenever we surface a stored access token in a response. */
const TOKEN_MASK = '********';

/**
 * Masks the access token on a config object for safe client transport.
 * Leaves an empty string alone so the UI can tell "never configured" apart
 * from "configured but hidden".
 */
function maskConfig(cfg: WhatsAppConfig): WhatsAppConfig {
  return {
    ...cfg,
    accessToken: cfg.accessToken ? TOKEN_MASK : '',
  };
}

async function requireOwner(flowId: string): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await getSession();
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    };
  }

  const flow = await getSabFlowById(flowId);
  if (!flow) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Flow not found' }, { status: 404 }),
    };
  }

  if (flow.userId !== session.user.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, userId: session.user.id };
}

function makeVerifyToken(): string {
  // 32 chars of [0-9a-f] — enough entropy for a per-flow verify token.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/* ── GET ──────────────────────────────────────────────────────────────────── */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ flowId: string }> },
) {
  const { flowId } = await params;

  const guard = await requireOwner(flowId);
  if (!guard.ok) return guard.response;

  const config = await getWhatsAppConfig(flowId);
  if (!config) {
    return NextResponse.json({ config: null });
  }

  return NextResponse.json({ config: maskConfig(config) });
}

/* ── POST ─────────────────────────────────────────────────────────────────── */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ flowId: string }> },
) {
  const { flowId } = await params;

  const guard = await requireOwner(flowId);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  const phoneNumberId = typeof raw.phoneNumberId === 'string' ? raw.phoneNumberId.trim() : '';
  const businessAccountId =
    typeof raw.businessAccountId === 'string' ? raw.businessAccountId.trim() : '';
  const accessTokenInput =
    typeof raw.accessToken === 'string' ? raw.accessToken.trim() : '';
  const verifyTokenInput =
    typeof raw.verifyToken === 'string' ? raw.verifyToken.trim() : '';

  if (!phoneNumberId) {
    return NextResponse.json({ error: '`phoneNumberId` is required' }, { status: 400 });
  }
  if (!businessAccountId) {
    return NextResponse.json({ error: '`businessAccountId` is required' }, { status: 400 });
  }

  // If the token equals the mask, treat it as "unchanged" and keep the
  // previously stored (encrypted) value.
  const existing = await getWhatsAppConfig(flowId);

  let encryptedAccessToken: string;
  if (!accessTokenInput || accessTokenInput === TOKEN_MASK) {
    if (!existing?.accessToken) {
      return NextResponse.json(
        { error: '`accessToken` is required on first save' },
        { status: 400 },
      );
    }
    encryptedAccessToken = existing.accessToken;
  } else {
    try {
      encryptedAccessToken = encryptData(accessTokenInput);
    } catch (err) {
      console.error('[SABFLOW WHATSAPP] Failed to encrypt access token:', err);
      return NextResponse.json(
        { error: 'Unable to persist access token securely' },
        { status: 500 },
      );
    }
  }

  const verifyToken = verifyTokenInput || existing?.verifyToken || makeVerifyToken();

  const config: WhatsAppConfig = {
    flowId,
    phoneNumberId,
    accessToken: encryptedAccessToken,
    verifyToken,
    businessAccountId,
    createdAt: existing?.createdAt,
    updatedAt: new Date(),
  };

  try {
    await saveWhatsAppConfig(config);
  } catch (err) {
    console.error('[SABFLOW WHATSAPP] Failed to save config:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, config: maskConfig(config) });
}
