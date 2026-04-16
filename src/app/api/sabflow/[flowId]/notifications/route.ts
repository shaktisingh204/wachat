/**
 * SabFlow — Notification settings API
 *
 * GET  /api/sabflow/[flowId]/notifications  → fetch settings
 * POST /api/sabflow/[flowId]/notifications  → upsert settings
 *
 * Both routes require a valid user session (httpOnly cookie auth).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import {
  getNotificationSettings,
  saveNotificationSettings,
} from '@/lib/sabflow/db';
import { getSabFlowById } from '@/lib/sabflow/db';
import type { FlowNotificationSettings } from '@/lib/sabflow/types';

export const dynamic = 'force-dynamic';

/* ── Auth guard ───────────────────────────────────────────────────────────── */

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

/* ── GET ──────────────────────────────────────────────────────────────────── */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ flowId: string }> },
) {
  const { flowId } = await params;

  const guard = await requireOwner(flowId);
  if (!guard.ok) return guard.response;

  const settings = await getNotificationSettings(flowId);

  // Return defaults when no document exists yet
  const defaults: FlowNotificationSettings = {
    flowId,
    emailOnSubmission: false,
    emailAddresses: [],
    webhookOnSubmission: false,
    digestEnabled: false,
    digestFrequency: 'daily',
  };

  return NextResponse.json(settings ?? defaults);
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

  // Validate + coerce fields
  const emailAddresses = Array.isArray(raw.emailAddresses)
    ? (raw.emailAddresses as unknown[]).filter((e): e is string => typeof e === 'string')
    : [];

  const digestFrequency: 'daily' | 'weekly' =
    raw.digestFrequency === 'weekly' ? 'weekly' : 'daily';

  const settings: FlowNotificationSettings = {
    flowId,
    emailOnSubmission: raw.emailOnSubmission === true,
    emailAddresses,
    webhookUrl: typeof raw.webhookUrl === 'string' ? raw.webhookUrl || undefined : undefined,
    webhookOnSubmission: raw.webhookOnSubmission === true,
    digestEnabled: raw.digestEnabled === true,
    digestFrequency,
    digestTime: typeof raw.digestTime === 'string' ? raw.digestTime || undefined : undefined,
  };

  await saveNotificationSettings(settings);

  return NextResponse.json({ ok: true, settings });
}
