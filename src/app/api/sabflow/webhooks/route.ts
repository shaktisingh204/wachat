/**
 * GET /api/sabflow/webhooks
 * GET /api/sabflow/webhooks?flowId=xxx
 *
 * Returns the webhook registrations for the authenticated user,
 * optionally filtered to a single flow.
 * Each record includes the public webhookUrl.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { listFlowWebhooks } from '@/lib/sabflow/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const userId = (session.user as { _id?: string | { toString(): string }; id?: string })
    ._id?.toString()
    ?? (session.user as { id?: string }).id
    ?? '';

  const flowId = new URL(req.url).searchParams.get('flowId') ?? undefined;

  try {
    const webhooks = await listFlowWebhooks(userId, flowId);
    const baseUrl = getBaseUrl();

    const result = webhooks.map((w) => ({
      id: w._id?.toString(),
      webhookId: w.webhookId,
      flowId: w.flowId,
      appEvent: w.appEvent,
      method: w.method,
      authentication: w.authentication,
      responseMode: w.responseMode,
      isActive: w.isActive,
      webhookUrl: `${baseUrl}/api/sabflow/webhook/${w.webhookId}`,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));

    return NextResponse.json({ webhooks: result });
  } catch (err) {
    console.error('[SABFLOW WEBHOOKS] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
