/**
 * SabFlow — Credentials API (single)
 *
 * GET    /api/sabflow/credentials/[id]      → { credential: MaskedCredential }
 * PATCH  /api/sabflow/credentials/[id]      body: { name?, data? }  → { ok: true }
 * DELETE /api/sabflow/credentials/[id]      → { ok: true }
 *
 * Only the owning user (workspace) may read / update / delete a credential.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import {
  deleteCredential,
  getCredentialById,
  updateCredential,
} from '@/lib/sabflow/credentials/db';
import {
  MASK_PLACEHOLDER,
  type Credential,
  type MaskedCredential,
} from '@/lib/sabflow/credentials/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

/* ── Shared helpers ─────────────────────────────────────────────────────── */

function maskCredential(cred: Credential): MaskedCredential {
  const data: Record<string, string> = {};
  for (const k of Object.keys(cred.data)) data[k] = MASK_PLACEHOLDER;
  return { ...cred, data };
}

async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const u = session.user as { _id?: string | { toString(): string }; id?: string };
  const userId = u._id ?? u.id;
  if (!userId) return null;
  return typeof userId === 'string' ? userId : String(userId);
}

async function requireOwnedCredential(id: string): Promise<
  | { ok: true; userId: string; credential: Credential }
  | { ok: false; response: NextResponse }
> {
  const userId = await resolveUserId();
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    };
  }

  const credential = await getCredentialById(id);
  if (!credential) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Credential not found' }, { status: 404 }),
    };
  }

  if (credential.workspaceId !== userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, userId, credential };
}

/* ── GET ────────────────────────────────────────────────────────────────── */

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const guard = await requireOwnedCredential(id);
  if (!guard.ok) return guard.response;

  return NextResponse.json({ credential: maskCredential(guard.credential) });
}

/* ── PATCH ──────────────────────────────────────────────────────────────── */

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const guard = await requireOwnedCredential(id);
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
  const updates: { name?: string; data?: Record<string, string> } = {};

  if (typeof raw.name === 'string') {
    const trimmed = raw.name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }
    updates.name = trimmed;
  }

  if (raw.data !== undefined) {
    if (!raw.data || typeof raw.data !== 'object' || Array.isArray(raw.data)) {
      return NextResponse.json({ error: '`data` must be an object' }, { status: 400 });
    }
    // Merge with existing plaintext values so that an unchanged masked value
    // (MASK_PLACEHOLDER) does NOT overwrite the real secret. The client sends
    // only the fields it changed, but may also send the original mask.
    const mergedData: Record<string, string> = { ...guard.credential.data };
    for (const [k, v] of Object.entries(raw.data as Record<string, unknown>)) {
      if (typeof k !== 'string') continue;
      if (v === undefined || v === null) continue;
      const str = typeof v === 'string' ? v : String(v);
      if (str === MASK_PLACEHOLDER) continue; // keep existing value
      mergedData[k] = str;
    }
    updates.data = mergedData;
  }

  if (updates.name === undefined && updates.data === undefined) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  try {
    await updateCredential(id, updates);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[SABFLOW CREDENTIALS] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* ── DELETE ─────────────────────────────────────────────────────────────── */

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const guard = await requireOwnedCredential(id);
  if (!guard.ok) return guard.response;

  try {
    await deleteCredential(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[SABFLOW CREDENTIALS] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
