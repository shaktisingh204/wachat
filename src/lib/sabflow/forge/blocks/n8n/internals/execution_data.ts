/**
 * Forge block: Execution Data
 *
 * Source: n8n-master/packages/nodes-base/nodes/ExecutionData/ExecutionData.node.ts
 * Credential type: none.
 *
 * Runtime: returns metadata about the current run pulled from
 * `ctx.variables` (the engine seeds `executionId`, `startedAt`, etc. there).
 * The SabFlow native equivalent is the run sidebar — this block is a way to
 * read those values from inside a flow.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function readMetadata(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const executionId = asString(ctx.variables.executionId) || 'unknown';
  const startedAt = asString(ctx.variables.startedAt) || 'unknown';
  return {
    outputs: { executionId, startedAt, mode: 'sabflow' },
    logs: [`ExecutionData read_metadata → ${executionId}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_execution_data',
  name: 'Execution Data',
  description: 'Read metadata about the current flow run.',
  iconName: 'LuInfo',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'read_metadata',
      label: 'Read metadata',
      description: 'Return executionId, startedAt and mode for the current run.',
      fields: [],
      run: readMetadata,
    },
  ],
};

registerForgeBlock(block);
export default block;
