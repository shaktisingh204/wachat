/**
 * GET /api/sabflow/recent-submissions
 *
 * Returns the last 10 submissions across all flows owned by the
 * authenticated user, joined with the flow name.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { getRecentSubmissions } from '@/lib/sabflow/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const rows = await getRecentSubmissions(session.user.id, 10);
  return NextResponse.json(rows);
}
