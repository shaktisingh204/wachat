/**
 * GET /api/sabflow/[flowId]/export-n8n
 *
 * Returns the flow as a downloadable n8n `workflow.json` payload.  The
 * file can be imported into n8n via "File → Import from URL/clipboard".
 *
 * Unsupported SabFlow block types (bubbles, choice inputs, etc.) export
 * as `n8n-nodes-base.set` with a `_sabflowOriginalType` parameter so the
 * round-trip back into SabFlow preserves the information.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { getSabFlowById } from '@/lib/sabflow/db';
import { exportToN8n } from '@/lib/sabflow/interop/n8nExport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ flowId: string }> },
) {
  console.log('[SABFLOW EXPORT-N8N] request received');
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = (session.user as { _id: { toString(): string } })._id.toString();
    const { flowId } = await ctx.params;

    const flow = await getSabFlowById(flowId);
    if (!flow) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }
    if (flow.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const exported = exportToN8n(flow);
    const filename = sanitiseFilename(flow.name) + '.n8n.json';

    // Respect the `?download=1` flag — clients can fetch as raw JSON when
    // not set.
    const url = new URL(req.url);
    const wantDownload = url.searchParams.get('download') === '1';

    const json = JSON.stringify(exported.workflow, null, 2);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json; charset=utf-8',
    };
    if (wantDownload) {
      headers['Content-Disposition'] = `attachment; filename="${filename}"`;
    }

    return new NextResponse(json, { status: 200, headers });
  } catch (err) {
    console.error('[SABFLOW EXPORT-N8N] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function sanitiseFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'sabflow';
}
