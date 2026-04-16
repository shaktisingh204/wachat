/**
 * SabFlow — Custom domain verification
 *
 * POST /api/sabflow/domains/[id]/verify
 *   → { verified: boolean; reason?: string; domain: CustomDomain }
 *
 * Queries Cloudflare's DoH resolver for `_sabflow.{domain}` and compares the
 * returned TXT record to the stored `verificationToken`. The domain's
 * `status` and `lastCheckedAt` are persisted.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import {
  getDomainById,
  updateDomain,
} from '@/lib/sabflow/domains/db';
import { verifyDomain } from '@/lib/sabflow/domains/verify';
import type { CustomDomain, DomainStatus } from '@/lib/sabflow/domains/types';

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

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const domain = await getDomainById(id);
  if (!domain) {
    return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
  }
  if (domain.workspaceId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await verifyDomain(domain.domain, domain.verificationToken);
  const nextStatus: DomainStatus = result.verified ? 'verified' : 'failed';
  const lastCheckedAt = new Date();

  try {
    await updateDomain(id, {
      status: nextStatus,
      lastCheckedAt,
    });
  } catch (err) {
    console.error('[SABFLOW DOMAINS] verify update error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  const updated: CustomDomain = {
    ...domain,
    status: nextStatus,
    lastCheckedAt,
  };

  return NextResponse.json({
    verified: result.verified,
    reason: result.reason,
    domain: updated,
  });
}
