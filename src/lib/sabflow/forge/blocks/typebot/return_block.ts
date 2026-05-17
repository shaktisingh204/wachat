/**
 * Forge block: Typebot Return (early-exit logic)
 *
 * Source: typebot.io-main/packages/blocks/logic/return/
 *
 * Typebot's `return` block stops the current flow and surfaces a structured
 * response payload to the caller. SabFlow flows can also "end naturally"
 * by hitting a node with no outgoing edge, but this block keeps the
 * typebot mental model intact for imported flows that explicitly mark a
 * terminal node.
 *
 * The action does not (currently) halt the engine — it just shapes the
 * response payload so a later flow consumer can read it from
 * `state.outputs.payload`. If a real parent-flow integration is added
 * later, this is where we'd wire an `errorSignal: 'halt'` equivalent.
 */

import { registerForgeBlock } from '../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../types';
import { asString } from '../n8n/_shared/http';

async function exit(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const raw = ctx.options.responsePayload;
  let payload: unknown;
  if (raw == null) {
    payload = {};
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      payload = {};
    } else {
      try {
        payload = JSON.parse(trimmed);
      } catch {
        // Not valid JSON — surface the string verbatim so flow authors can
        // still hand back a plain message.
        payload = trimmed;
      }
    }
  } else {
    payload = raw;
  }

  return {
    outputs: { returned: true, payload },
    logs: [`Typebot return → ${asString(JSON.stringify(payload)).slice(0, 100)}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_typebot_return',
  name: 'Return (typebot)',
  description:
    'Exit the flow with a structured response payload. SabFlow flows can also end naturally by hitting a node with no outgoing edge — this matches typebot\'s explicit return semantics for imported flows.',
  iconName: 'LuArrowLeft',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'exit',
      label: 'Return from flow',
      description: 'Emit a payload and mark the flow as returned.',
      fields: [
        {
          id: 'responsePayload',
          label: 'Response payload',
          type: 'json',
          placeholder: '{ "status": "ok", "answer": "{{userInput}}" }',
          helperText:
            'JSON object handed back to the flow caller. Plain strings are forwarded verbatim.',
        },
      ],
      run: exit,
    },
  ],
};

registerForgeBlock(block);
export default block;
