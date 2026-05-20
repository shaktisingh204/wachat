/**
 * Forge block: Error Trigger (port of ErrorTrigger as a one-shot info action)
 *
 * Source: n8n-master/packages/nodes-base/nodes/ErrorTrigger/ErrorTrigger.node.ts
 *
 * Note: n8n's runtime trigger semantics don't apply here — this port is for
 * catalog parity. SabFlow's `onError` branch in the flow runner is the real
 * equivalent; see src/lib/sabflow/triggers/ and the flow engine. This action
 * just documents the shape of the error payload n8n exposes.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

async function info(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const shape = {
    execution: {
      id: 'string',
      url: 'string',
      retryOf: 'string | null',
      error: {
        message: 'string',
        stack: 'string',
      },
      lastNodeExecuted: 'string',
      mode: 'manual | trigger | error | retry',
    },
    workflow: {
      id: 'string',
      name: 'string',
    },
  };
  return {
    outputs: {
      shape,
      note: 'Use SabFlow onError branches for the real error-trigger path.',
    },
    logs: ['Error Trigger info → returned error payload shape'],
  };
}

const block: ForgeBlock = {
  id: 'forge_error_trigger',
  name: 'Error Trigger',
  description: 'Describe the legacy error payload shape. SabFlow onError is the real path.',
  iconName: 'LuTriangleAlert',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'info',
      label: 'Info',
      description: 'Return the shape of the error data exposed on a failed workflow.',
      fields: [],
      run: info,
    },
  ],
};

registerForgeBlock(block);
export default block;
