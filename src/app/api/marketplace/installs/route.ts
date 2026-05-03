/**
 * GET /api/marketplace/installs — list installs for the authenticated tenant.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { listInstallsForTenant } from '@/lib/marketplace';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const installs = await listInstallsForTenant(session.user._id.toString());
    return NextResponse.json({ installs });
  } catch (err) {
    console.error('[marketplace/installs GET]', err);
    return NextResponse.json({ error: 'Failed to list installs' }, { status: 500 });
  }
}
