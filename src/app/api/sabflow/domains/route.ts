/**
 * SabFlow — Custom domains API (collection)
 *
 * GET  /api/sabflow/domains
 *   → { domains: CustomDomain[] }
 *
 * POST /api/sabflow/domains
 *   Body: { domain: string; flowId?: string }
 *   → { domain: CustomDomain }            201
 *
 * Authentication is enforced via the `session` cookie.  A domain is always
 * created for the authenticated user's workspace.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import {
  createDomain,
  getDomainByName,
  getDomainsByWorkspace,
} from '@/lib/sabflow/domains/db';
import { normaliseDomain } from '@/lib/sabflow/domains/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const u = session.user as { _id?: string | { toString(): string }; id?: string };
  const raw = u._id ?? u.id;
  if (!raw) return null;
  return typeof raw === 'string' ? raw : String(raw);
}

/* ── GET ────────────────────────────────────────────────────────────────── */

export async function GET(_req: NextRequest) {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const domains = await getDomainsByWorkspace(userId);
    return NextResponse.json({ domains });
  } catch (err) {
    console.error('[SABFLOW DOMAINS] GET error:', err);
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

  if (typeof raw.domain !== 'string' || !raw.domain.trim()) {
    return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
  }

  const normalised = normaliseDomain(raw.domain);
  if (!normalised) {
    return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
  }

  const flowId =
    typeof raw.flowId === 'string' && raw.flowId.trim() ? raw.flowId.trim() : undefined;

  // Prevent duplicate registrations (DB also has a unique index, but this
  // gives us a nicer error and avoids a Mongo write failure).
  try {
    const existing = await getDomainByName(normalised);
    if (existing) {
      return NextResponse.json(
        { error: 'Domain already registered' },
        { status: 409 },
      );
    }
  } catch (err) {
    console.error('[SABFLOW DOMAINS] POST pre-check error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  try {
    const domain = await createDomain({
      workspaceId: userId,
      domain: normalised,
      flowId,
    });
    return NextResponse.json({ domain }, { status: 201 });
  } catch (err) {
    console.error('[SABFLOW DOMAINS] POST error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
