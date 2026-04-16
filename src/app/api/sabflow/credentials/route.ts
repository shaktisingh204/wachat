/**
 * SabFlow — Credentials API (collection)
 *
 * GET  /api/sabflow/credentials?workspaceId=xxx&type=xxx
 *   → { credentials: MaskedCredential[] }
 *
 * POST /api/sabflow/credentials
 *   Body: { workspaceId, type, name, data }
 *   → { id }
 *
 * Authentication is enforced via the `session` cookie.  The authenticated
 * user's id must match the requested `workspaceId` (multi-tenant isolation).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import {
  createCredential,
  getCredentials,
} from '@/lib/sabflow/credentials/db';
import {
  CREDENTIAL_TYPES,
  MASK_PLACEHOLDER,
  type Credential,
  type CredentialType,
  type MaskedCredential,
} from '@/lib/sabflow/credentials/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ── Utilities ──────────────────────────────────────────────────────────── */

function isCredentialType(v: unknown): v is CredentialType {
  return typeof v === 'string' && (CREDENTIAL_TYPES as string[]).includes(v);
}

/** Replace every value in `data` with the masked placeholder. */
function maskData(data: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(data)) {
    out[k] = MASK_PLACEHOLDER;
  }
  return out;
}

function maskCredential(cred: Credential): MaskedCredential {
  return { ...cred, data: maskData(cred.data) };
}

async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  // session.user._id is a string after serialization in getSession()
  const userId =
    (session.user as { _id?: string | { toString(): string }; id?: string })._id ??
    (session.user as { id?: string }).id;
  if (!userId) return null;
  return typeof userId === 'string' ? userId : String(userId);
}

/* ── GET ────────────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId') ?? userId;
  const typeParam = searchParams.get('type');

  if (workspaceId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let type: CredentialType | undefined;
  if (typeParam) {
    if (!isCredentialType(typeParam)) {
      return NextResponse.json({ error: 'Invalid credential type' }, { status: 400 });
    }
    type = typeParam;
  }

  try {
    const creds = await getCredentials(workspaceId, type);
    const credentials: MaskedCredential[] = creds.map(maskCredential);
    return NextResponse.json({ credentials });
  } catch (err) {
    console.error('[SABFLOW CREDENTIALS] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ── POST ───────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

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
  const workspaceId = typeof raw.workspaceId === 'string' ? raw.workspaceId : userId;

  if (workspaceId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!isCredentialType(raw.type)) {
    return NextResponse.json({ error: 'Invalid credential type' }, { status: 400 });
  }

  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  // Normalise `data`: only accept string keys → string values.
  const rawData = raw.data;
  const data: Record<string, string> = {};
  if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
    for (const [k, v] of Object.entries(rawData as Record<string, unknown>)) {
      if (typeof k !== 'string') continue;
      if (v === undefined || v === null) continue;
      data[k] = typeof v === 'string' ? v : String(v);
    }
  }

  try {
    const id = await createCredential({
      workspaceId,
      type: raw.type,
      name,
      data,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error('[SABFLOW CREDENTIALS] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
