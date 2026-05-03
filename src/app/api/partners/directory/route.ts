/**
 * GET /api/partners/directory — public partner directory.
 *
 * Unauthenticated. Supports search and filtering by region, specialty and
 * tier. Mongo collection: `partners`. Only `status: 'active'` rows are
 * returned, and the response goes through `toPublic()` to strip internal
 * financial signals.
 *
 * Query params:
 *   - q          free-text over name + description
 *   - region     ISO-3166 alpha-2 country code
 *   - specialty  one of PartnerSpecialty
 *   - tier       one of PartnerTier
 *   - page       1-indexed pagination, default 1
 *   - limit      1..100, default 20
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import { filterPartners } from '@/lib/partners/directory';
import type { Partner, PartnerSpecialty, PartnerTier } from '@/lib/partners/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_SPECIALTIES: PartnerSpecialty[] = [
  'whatsapp',
  'crm',
  'seo',
  'automation',
  'commerce',
  'ai',
  'integrations',
];
const VALID_TIERS: PartnerTier[] = ['bronze', 'silver', 'gold', 'platinum'];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const search = url.searchParams;

  const specialty = search.get('specialty');
  const tier = search.get('tier');

  const filter = {
    q: search.get('q') ?? undefined,
    region: search.get('region')?.toUpperCase() ?? undefined,
    specialty:
      specialty && VALID_SPECIALTIES.includes(specialty as PartnerSpecialty)
        ? (specialty as PartnerSpecialty)
        : undefined,
    tier:
      tier && VALID_TIERS.includes(tier as PartnerTier) ? (tier as PartnerTier) : undefined,
    page: parsePositiveInt(search.get('page'), 1),
    limit: parsePositiveInt(search.get('limit'), 20),
  };

  try {
    const { db } = await connectToDatabase();
    const partners = (await db.collection('partners').find({ status: 'active' }).toArray()) as unknown as Partner[];
    const result = filterPartners(partners, filter);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load partner directory.';
    console.error('[api/partners/directory] failed', { error: message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
