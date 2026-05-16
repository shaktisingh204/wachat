/**
 * Forge block: LangChain Tool — Think
 *
 * Source: @n8n/nodes-langchain/nodes/tools/ToolThink/
 *
 * "Think" is a scratchpad tool: the LLM passes a string of reasoning and
 * the tool returns it unchanged. It exists so that tool-calling agents can
 * record intermediate thoughts in the run transcript without taking any
 * action.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

async function reflect(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const thought = asString(ctx.options.thought);

  return {
    outputs: { thought, text: thought },
    logs: [`Think → ${thought.length} chars`],
  };
}

const block: ForgeBlock = {
  id: 'forge_tool_think',
  name: 'LangChain Tool — Think',
  description: 'Scratchpad tool: passes the thought through and logs it in the transcript.',
  iconName: 'LuBrain',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'reflect',
      label: 'Record a thought',
      fields: [
        {
          id: 'thought',
          label: 'Thought',
          type: 'textarea',
          required: true,
          placeholder: 'I should first search Wikipedia, then call the calculator…',
        },
      ],
      run: reflect,
    },
  ],
};

registerForgeBlock(block);
export default block;
