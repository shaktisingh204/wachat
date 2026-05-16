/**
 * Forge block: Split In Batches
 *
 * Source: n8n-master/packages/nodes-base/nodes/SplitInBatches/SplitInBatches.node.ts
 * Credential type: none.
 *
 * Runtime: stateless slice of an input array. The action emits the next
 * `batch`, the `nextCursor` (so the caller can feed it back in on the next
 * iteration) and a `done` flag. The SabFlow native equivalent is the "Loop
 * over list" canvas primitive — prefer that for new flows; this exists for
 * imported n8n parity.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber } from '../_shared/http';

async function nextBatch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const rawItems = ctx.options.items;
  if (!Array.isArray(rawItems)) {
    throw new Error('SplitInBatches: items must be a JSON array');
  }
  const items = rawItems as unknown[];
  const batchSize = Math.max(1, asNumber(ctx.options.batchSize) ?? 10);
  const cursor = Math.max(0, asNumber(ctx.options.cursor) ?? 0);
  const batch = items.slice(cursor, cursor + batchSize);
  const nextCursor = cursor + batch.length;
  const done = nextCursor >= items.length;
  return {
    outputs: { batch, nextCursor, done, total: items.length },
    logs: [`SplitInBatches next_batch → ${batch.length} items (cursor ${cursor} → ${nextCursor}, done=${done})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_split_in_batches',
  name: 'Split In Batches',
  description: 'Slice an array into batches using a caller-supplied cursor.',
  iconName: 'LuLayers',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'next_batch',
      label: 'Next batch',
      description: 'Return the next slice of the array starting at `cursor`.',
      fields: [
        {
          id: 'items',
          label: 'Items',
          type: 'json',
          required: true,
          placeholder: '[1, 2, 3, 4, 5]',
          helperText: 'JSON array to slice.',
        },
        {
          id: 'batchSize',
          label: 'Batch size',
          type: 'number',
          defaultValue: 10,
        },
        {
          id: 'cursor',
          label: 'Cursor',
          type: 'number',
          defaultValue: 0,
          helperText: 'Index to start the slice. Feed `nextCursor` back in on each iteration.',
        },
      ],
      run: nextBatch,
    },
  ],
};

registerForgeBlock(block);
export default block;
