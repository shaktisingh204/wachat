/**
 * Forge block: LangChain Tool — Calculator (n8n compatibility)
 *
 * Source: @n8n/nodes-langchain/nodes/tools/ToolCalculator/
 *
 * Delegates to `forge_tools_calculator` (the canonical port). This wrapper
 * exists so an LLM agent can call the well-known `forge_tool_calculator_n8n`
 * id and we still benefit from a single safe-eval implementation.
 */

import { getForgeBlock, registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

async function compute(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const expression = asString(ctx.options.expression);
  const inner = getForgeBlock('forge_tools_calculator');
  const action = inner?.actions?.[0];
  if (!action) {
    throw new Error('Calculator (n8n): inner block forge_tools_calculator is not registered');
  }

  const res = await action.run({
    ...ctx,
    options: { ...ctx.options, expression },
  });
  const result = res.outputs?.result;
  const text = typeof result === 'number' ? String(result) : asString(result);

  return {
    outputs: { ...(res.outputs ?? {}), text },
    logs: res.logs,
  };
}

const block: ForgeBlock = {
  id: 'forge_tool_calculator_n8n',
  name: 'LangChain Tool — Calculator',
  description: 'Tool-call wrapper around the SabFlow calculator with a string output.',
  iconName: 'LuCalculator',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'compute',
      label: 'Evaluate expression',
      fields: [
        {
          id: 'expression',
          label: 'Expression',
          type: 'text',
          required: true,
          placeholder: '2 + 2 * Math.sqrt(16)',
        },
      ],
      run: compute,
    },
  ],
};

registerForgeBlock(block);
export default block;
