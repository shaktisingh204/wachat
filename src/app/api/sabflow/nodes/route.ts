/**
 * GET /api/sabflow/nodes
 *
 * Proxies to the Rust `sabflow-engine-runtime` `/v1/sabflow/nodes` endpoint
 * which returns every registered `NodeDescriptor` (80 implemented + ~230 stubs).
 *
 * The frontend uses this to populate the block picker and to render the
 * generic `NodeSettings` panel for nodes that don't have a hand-built UI.
 */

import { NextResponse } from 'next/server';
import { rustFetch } from '@/lib/rust-client/fetcher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Cache for 60s in production — descriptors are static at runtime.
export const revalidate = 60;

export async function GET() {
  try {
    const data = await rustFetch<{ nodes: unknown[] }>('/v1/sabflow/nodes', { method: 'GET' });
    return NextResponse.json(data);
  } catch (err) {
    console.error('[SABFLOW NODES] list error:', err);
    return NextResponse.json({ error: 'Failed to load node descriptors' }, { status: 500 });
  }
}
