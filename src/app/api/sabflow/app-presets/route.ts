/**
 * SabFlow — App preset summary list.
 *
 *   GET /api/sabflow/app-presets
 *     → { presets: AppPresetSummary[], count: number }
 *
 * Drives the picker's Tier 2 section. The summary projection keeps payload
 * small (no endpoint definitions) — the per-id route below loads details
 * on demand when a preset is selected.
 *
 * Listing is gated on completeness (non-empty baseUrl + ≥1 endpoint) so the
 * picker only ever offers executable presets. Complete drafts are listed with
 * `draft: true`. Pass `?includeDrafts=1` (admin/debug) to also surface
 * incomplete presets — those carry `complete: false`.
 */

import { NextResponse } from 'next/server';

import { listPresetSummaries } from '@/lib/sabflow/app-presets/runtime/loader';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const includeIncomplete =
    new URL(request.url).searchParams.get('includeDrafts') === '1';
  const presets = await listPresetSummaries({ includeIncomplete });
  return NextResponse.json({ presets, count: presets.length });
}
