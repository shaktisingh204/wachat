/**
 * GET  /api/sabflow/workspaces
 *   Lists every workspace the authenticated user is a member of.
 *
 * POST /api/sabflow/workspaces
 *   Creates a new workspace owned by the authenticated user.
 *   Body: { name: string; slug?: string; iconUrl?: string }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import {
  createWorkspace,
  getWorkspacesByUser,
} from '@/lib/sabflow/workspaces/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const workspaces = await getWorkspacesByUser(session.user._id.toString());
    return NextResponse.json({ workspaces });
  } catch (err) {
    console.error('[sabflow/workspaces GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
      slug?: unknown;
      iconUrl?: unknown;
    };

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const workspace = await createWorkspace({
      name,
      slug: typeof body.slug === 'string' ? body.slug : undefined,
      iconUrl: typeof body.iconUrl === 'string' ? body.iconUrl : undefined,
      ownerId: session.user._id.toString(),
    });

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (err) {
    console.error('[sabflow/workspaces POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
