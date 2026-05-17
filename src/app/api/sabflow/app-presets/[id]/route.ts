/**
 * SabFlow — App preset detail.
 *
 *   GET /api/sabflow/app-presets/[id]
 *     → AppPreset | { error: 'not found' }
 *
 * The settings panel for a `forge_app_preset` block fetches the full preset
 * via this route to render endpoint + field metadata in the existing
 * ForgeFieldRenderer.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { loadPreset } from '@/lib/sabflow/app-presets/runtime/loader';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const preset = await loadPreset(id);
  if (!preset) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  return NextResponse.json(preset);
}
