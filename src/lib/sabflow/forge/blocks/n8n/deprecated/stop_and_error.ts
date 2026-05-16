/**
 * Forge block: Stop and Error
 *
 * Source: n8n-master/packages/nodes-base/nodes/StopAndError/StopAndError.node.ts
 *
 * n8n's "halt with an error" node. SabFlow has a native engine-level
 * equivalent (`errorSignal: halt`) — this block exists for migration
 * parity so legacy workflows can be imported without rewrites.
 *
 * Operations covered:
 *   - stop(message | errorObject) — throws an Error and halts the flow.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function stop(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const mode = asString(ctx.options.mode) || 'message';

  if (mode === 'object') {
    const raw = asString(ctx.options.errorObject);
    if (!raw) throw new Error('Stop and Error: errorObject is required');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Stop and Error: errorObject is not valid JSON — ${(err as Error).message}`);
    }
    const msg = (() => {
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        const m = asString(obj.message ?? obj.description ?? obj.error);
        if (m) return m;
      }
      return JSON.stringify(parsed);
    })();
    throw new Error(msg);
  }

  const message = asString(ctx.options.message);
  if (!message) throw new Error('Stop and Error: message is required');
  throw new Error(message);
}

const block: ForgeBlock = {
  id: 'forge_stop_and_error',
  name: 'Stop and Error',
  description: 'Halt the flow by throwing an error. SabFlow native equivalent: `errorSignal: halt`.',
  iconName: 'LuOctagonAlert',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'stop',
      label: 'Stop with error',
      description: 'Throw an error and halt the flow. Choose a plain message or a structured JSON error object.',
      fields: [
        {
          id: 'mode',
          label: 'Error type',
          type: 'select',
          defaultValue: 'message',
          options: [
            { label: 'Error message', value: 'message' },
            { label: 'Error object', value: 'object' },
          ],
        },
        {
          id: 'message',
          label: 'Error message',
          type: 'text',
          placeholder: 'An error occurred!',
          showIf: { field: 'mode', equals: 'message' },
        },
        {
          id: 'errorObject',
          label: 'Error object',
          type: 'json',
          placeholder: '{"code":"404","description":"The resource could not be fetched"}',
          helperText: 'JSON object. Thrown message uses `message`, `description`, or `error` if present.',
          showIf: { field: 'mode', equals: 'object' },
        },
      ],
      run: stop,
    },
  ],
};

registerForgeBlock(block);
export default block;
