/**
 * GET /api/sabflow/nodes/[type]
 *
 * Proxies to the Rust `sabflow-engine-runtime` `/v1/sabflow/nodes/{type}` endpoint
 * which returns a single `NodeDescriptor`. Used by the generic `NodeSettings`
 * React component to render a settings panel from declarative metadata.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { rustFetch } from '@/lib/rust-client/fetcher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 60;

type RouteContext = { params: Promise<{ type: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { type } = await params;

  if (!type || !/^[A-Za-z0-9_]+$/.test(type)) {
    return NextResponse.json({ error: 'Invalid node type' }, { status: 400 });
  }

  try {
    const data = await rustFetch<unknown>(`/v1/sabflow/nodes/${encodeURIComponent(type)}`, {
      method: 'GET',
    });
    return NextResponse.json(data);
  } catch (err) {
    const status = (err as { status?: number })?.status ?? 500;
    if (status === 404) {
      return NextResponse.json({ error: `Unknown node: ${type}` }, { status: 404 });
    }
    console.error('[SABFLOW NODES] descriptor error:', err);
    return NextResponse.json({ error: 'Failed to load node descriptor' }, { status: 500 });
  }
}
