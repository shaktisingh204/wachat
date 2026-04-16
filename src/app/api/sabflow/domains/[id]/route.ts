/**
 * SabFlow — Custom domains API (single)
 *
 * GET    /api/sabflow/domains/[id]   → { domain: CustomDomain }
 * DELETE /api/sabflow/domains/[id]   → { ok: true }
 *
 * Only the owning user (workspace) may read or delete a custom domain.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import {
  deleteDomain,
  getDomainById,
} from '@/lib/sabflow/domains/db';
import type { CustomDomain } from '@/lib/sabflow/domains/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

async function resolveUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const u = session.user as { _id?: string | { toString(): string }; id?: string };
  const raw = u._id ?? u.id;
  if (!raw) return null;
  return typeof raw === 'string' ? raw : String(raw);
}

async function requireOwnedDomain(id: string): Promise<
  | { ok: true; userId: string; domain: CustomDomain }
  | { ok: false; response: NextResponse }
> {
  const userId = await resolveUserId();
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    };
  }

  const domain = await getDomainById(id);
  if (!domain) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Domain not found' }, { status: 404 }),
    };
  }
  if (domain.workspaceId !== userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, userId, domain };
}

/* ── GET ────────────────────────────────────────────────────────────────── */

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const guard = await requireOwnedDomain(id);
  if (!guard.ok) return guard.response;
  return NextResponse.json({ domain: guard.domain });
}

/* ── DELETE ─────────────────────────────────────────────────────────────── */

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const guard = await requireOwnedDomain(id);
  if (!guard.ok) return guard.response;

  try {
    await deleteDomain(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[SABFLOW DOMAINS] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
