/**
 * SabSMS — SabFlow block catalog.
 *
 * Serves the REAL SabFlow forge blocks that route through the SabSMS engine
 * (currently `forge_sabsms` with its `send_sms` / `wait_for_reply` actions),
 * projected per-action into a flat, serializable list. Replaces the old
 * MOCK_BLOCKS fixture. Session-guarded.
 *
 *   GET /api/sabsms/blocks → { blocks: SabsmsBlock[] }
 */
import { NextResponse } from 'next/server';
import '@/lib/sabflow/forge';
import { getForgeBlocks } from '@/lib/sabflow/forge/registry';
import { getCachedSession } from '@/lib/server-cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface SabsmsBlock {
  /** `${blockId}:${actionId}` — stable per-action id. */
  id: string;
  blockId: string;
  actionId: string;
  name: string;
  description: string;
  /** "trigger" for waits/replies, "action" otherwise (best-effort). */
  type: 'trigger' | 'action';
  category: string;
  iconName?: string;
  /** Field ids the action accepts — a lightweight schema view. */
  fields: string[];
  /** Declared branch outputs (e.g. replied / timeout), if any. */
  outputs: string[];
}

/** A forge action with a name implying it waits/listens is trigger-ish. */
function actionType(actionId: string): 'trigger' | 'action' {
  return /wait|reply|inbound|received|listen/i.test(actionId) ? 'trigger' : 'action';
}

function isSabsmsBlock(id: string): boolean {
  return id === 'forge_sabsms' || id.startsWith('forge_sabsms');
}

export async function GET() {
  const session = await getCachedSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const blocks: SabsmsBlock[] = [];
  for (const block of getForgeBlocks()) {
    if (!isSabsmsBlock(block.id)) continue;
    for (const action of block.actions ?? []) {
      blocks.push({
        id: `${block.id}:${action.id}`,
        blockId: block.id,
        actionId: action.id,
        name: action.label || action.id,
        description: action.description || block.description,
        type: actionType(action.id),
        category: block.category,
        iconName: block.iconName,
        fields: (action.fields ?? []).map((f) => f.id),
        outputs: (action.outputs ?? []).map((o) => o.name),
      });
    }
  }

  return NextResponse.json({ blocks });
}
