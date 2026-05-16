/**
 * SabFlow — Forge metadata API.
 *
 * Serializable view of every registered forge block. Client components import
 * this via fetch instead of reaching into `@/lib/sabflow/forge` directly,
 * which is server-only.
 *
 *   GET /api/sabflow/forge-metadata
 *     → { blocks: Record<blockId, ForgeBlockMetadata> }
 *
 * The metadata strips every `run` function (functions don't survive
 * JSON serialization). Settings panels never invoke `run` — the engine does
 * that server-side — so a metadata-only view is enough for UI.
 */

import { NextResponse } from 'next/server';
import '@/lib/sabflow/forge';
import { getForgeBlocks } from '@/lib/sabflow/forge/registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET() {
  const blocks: Record<string, unknown> = {};
  for (const block of getForgeBlocks()) {
    blocks[block.id] = {
      id: block.id,
      name: block.name,
      description: block.description,
      iconName: block.iconName,
      iconUrl: block.iconUrl,
      category: block.category,
      auth: block.auth,
      fields: block.fields,
      actions: block.actions?.map((a) => ({
        id: a.id,
        label: a.label,
        description: a.description,
        fields: a.fields,
      })),
    };
  }
  return NextResponse.json({ blocks });
}
