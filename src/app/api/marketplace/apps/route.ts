/**
 * GET  /api/marketplace/apps        — public catalogue listing.
 * POST /api/marketplace/apps        — submit a new app (auth required).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import {
  listApps,
  registerApp,
  validateManifest,
  type AppListFilter,
} from '@/lib/marketplace';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const filter: AppListFilter = {
    q: url.searchParams.get('q') ?? undefined,
    category: url.searchParams.get('category') ?? undefined,
    pricingType: (url.searchParams.get('pricingType') as AppListFilter['pricingType']) ?? undefined,
    page: numParam(url.searchParams.get('page')),
    limit: numParam(url.searchParams.get('limit')),
  };

  try {
    const result = await listApps(filter);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[marketplace/apps GET]', err);
    return NextResponse.json({ error: 'Failed to list apps' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = validateManifest((body as { manifest?: unknown })?.manifest ?? body);
  if (!validation.ok || !validation.manifest) {
    return NextResponse.json(
      { error: 'Invalid manifest', details: validation.errors },
      { status: 400 },
    );
  }

  try {
    const app = await registerApp(validation.manifest, {
      ownerId: session.user._id.toString(),
      autoPublish: false,
    });
    return NextResponse.json({ app }, { status: 201 });
  } catch (err) {
    console.error('[marketplace/apps POST]', err);
    return NextResponse.json({ error: 'Failed to submit app' }, { status: 500 });
  }
}

function numParam(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}
