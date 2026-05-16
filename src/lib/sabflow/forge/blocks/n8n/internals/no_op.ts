/**
 * Forge block: NoOp
 *
 * Source: n8n-master/packages/nodes-base/nodes/NoOp/NoOp.node.ts
 * Credential type: none.
 *
 * Runtime: a pass-through block that emits whatever `passthrough` json was
 * provided (or `{}` when nothing was supplied). The n8n node is used to
 * visually break up complex flows; SabFlow has no semantic equivalent — the
 * graph itself is the divider — so this is here purely for catalog parity
 * with imported n8n workflows.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';

async function noop(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const passthrough = ctx.options.passthrough;
  const result =
    passthrough && typeof passthrough === 'object' ? passthrough : {};
  return { outputs: { result }, logs: ['NoOp → pass-through'] };
}

const block: ForgeBlock = {
  id: 'forge_no_op',
  name: 'No Op',
  description: 'Pass-through block — emits its input unchanged.',
  iconName: 'LuCircleSlash',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'noop',
      label: 'No operation',
      description: 'Emit `passthrough` (or {}) and continue.',
      fields: [
        {
          id: 'passthrough',
          label: 'Passthrough payload',
          type: 'json',
          placeholder: '{}',
          helperText: 'JSON object emitted as `result`. Optional.',
        },
      ],
      run: noop,
    },
  ],
};

registerForgeBlock(block);
export default block;
