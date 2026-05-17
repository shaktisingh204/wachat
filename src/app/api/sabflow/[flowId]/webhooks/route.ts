/**
 * GET /api/sabflow/[flowId]/webhooks — list webhook registrations.
 *
 * Returns rows from the `sabflow_webhooks` collection that belong to the
 * caller and the given flow.  Includes the full public URL each webhook
 * lives at, so the management page can render copy/test buttons.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { listFlowWebhooks } from '@/lib/sabflow/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ flowId: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = (session.user as { _id: { toString(): string } })._id.toString();
  const { flowId } = await ctx.params;

  try {
    const rows = await listFlowWebhooks(userId, flowId);
    const base =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
      new URL(req.url).origin;
    return NextResponse.json({
      webhooks: rows.map((w) => ({
        webhookId: w.webhookId,
        appEvent: w.appEvent,
        method: w.method,
        authentication: w.authentication,
        responseMode: w.responseMode,
        isActive: w.isActive,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        publicUrl: `${base}/api/sabflow/webhook/${w.webhookId}`,
      })),
    });
  } catch (err) {
    console.error('[SABFLOW WEBHOOK LIST] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
