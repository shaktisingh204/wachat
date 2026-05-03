/**
 * GET /api/marketplace/apps/:id — public app detail.
 *
 * `:id` is the manifest id (e.g. "acme-crm-sync"), not the Mongo ObjectId.
 * Unpublished apps are only visible to their owner.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { getApp } from '@/lib/marketplace';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: 'App id required' }, { status: 400 });
  }
  try {
    const app = await getApp(id);
    if (!app) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (app.status !== 'published') {
      const session = await getSession();
      const viewerId = session?.user?._id?.toString();
      if (!viewerId || viewerId !== app.ownerId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }
    return NextResponse.json({ app });
  } catch (err) {
    console.error('[marketplace/apps/:id GET]', err);
    return NextResponse.json({ error: 'Failed to load app' }, { status: 500 });
  }
}
