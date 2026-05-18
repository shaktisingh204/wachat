/**
 * SabFlow share-link token API.
 *
 *   POST   /api/sabflow/docs/[docId]/share
 *     Body: { role?: 'viewer'|'editor'; expiresInDays?: number }
 *     → { token, url }
 *
 *   DELETE /api/sabflow/docs/[docId]/share
 *     Body: { token: string }
 *     → { ok: true }
 *
 *   GET    /api/sabflow/docs/[docId]/share
 *     → { links: ShareLinkDoc[] }
 *
 * Auth: session required.
 * RBAC: `sabflow.doc.share` permission required for POST and DELETE.
 *
 * C.8.3 — share-link token API.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import {
  createShareLink,
  revokeShareLink,
  listShareLinks,
  type ShareLinkRole,
} from '@/lib/sabflow/share-links';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ docId: string }> };

// ── helpers ──────────────────────────────────────────────────────────────────

async function resolveSession(): Promise<{
  userId: string;
  workspaceId: string;
} | null> {
  const session = await getSession();
  if (!session?.user) return null;
  const u = session.user as {
    _id?: { toString(): string } | string;
    id?: string;
    activeProjectId?: string;
  };
  const userId = (
    typeof u._id === 'object' ? u._id?.toString() : u._id
  ) ?? u.id ?? '';
  const workspaceId = u.activeProjectId ?? userId;
  if (!userId) return null;
  return { userId, workspaceId };
}

async function guardShare(workspaceId: string) {
  return requirePermission('sabflow.doc.share', 'edit', workspaceId);
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  context: RouteContext,
) {
  const { docId } = await context.params;
  if (!docId) {
    return NextResponse.json({ error: 'Missing docId.' }, { status: 400 });
  }

  const identity = await resolveSession();
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const links = await listShareLinks(docId);
    return NextResponse.json({ links });
  } catch (err) {
    console.error('[SABFLOW SHARE] GET error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  context: RouteContext,
) {
  const { docId } = await context.params;
  if (!docId) {
    return NextResponse.json({ error: 'Missing docId.' }, { status: 400 });
  }

  const identity = await resolveSession();
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const guard = await guardShare(identity.workspaceId);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: 403 });
  }

  let body: { role?: unknown; expiresInDays?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const role: ShareLinkRole =
    body.role === 'editor' ? 'editor' : 'viewer';

  const rawDays = Number(body.expiresInDays);
  const expiresInDays =
    Number.isFinite(rawDays) && rawDays > 0 && rawDays <= 365 ? rawDays : 7;

  try {
    const token = await createShareLink(docId, role, expiresInDays, identity.userId);
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
    const url = `${appUrl}/sabflow/share/${token}`;
    return NextResponse.json({ token, url }, { status: 201 });
  } catch (err) {
    console.error('[SABFLOW SHARE] POST error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  context: RouteContext,
) {
  const { docId } = await context.params;
  if (!docId) {
    return NextResponse.json({ error: 'Missing docId.' }, { status: 400 });
  }

  const identity = await resolveSession();
  if (!identity) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const guard = await guardShare(identity.workspaceId);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: 403 });
  }

  let body: { token?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  if (!body.token || typeof body.token !== 'string') {
    return NextResponse.json({ error: '`token` is required.' }, { status: 400 });
  }

  try {
    await revokeShareLink(body.token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[SABFLOW SHARE] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
