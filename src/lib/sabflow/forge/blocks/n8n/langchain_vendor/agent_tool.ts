/**
 * Forge block: LangChain Agent-as-Tool
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/agents/Agent/AgentTool.node.ts
 *         + AgentToolV2.node.ts + AgentToolV3.node.ts (versioned variants
 *         collapse into one port).
 *
 * Wraps a sub-agent so a parent agent can call it as a tool. SabFlow stores
 * the sub-agent's id + a function description; the runtime exposes a callable
 * surface to the upstream agent node. No external API calls at this layer —
 * actual invocation runs through `forge_agent`.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';
import { parseJsonObject } from '../_shared/json';

async function expose(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const toolName = asString(ctx.options.tool_name);
  const description = asString(ctx.options.description);
  const subAgentId = asString(ctx.options.sub_agent_id);
  const inputSchema = ctx.options.input_schema ? parseJsonObject(ctx.options.input_schema, 'Agent Tool: input_schema') : {};
  if (!toolName) throw new Error('Agent Tool: tool_name is required');
  if (!description) throw new Error('Agent Tool: description is required');
  if (!subAgentId) throw new Error('Agent Tool: sub_agent_id is required');
  return {
    outputs: {
      tool: {
        name: toolName,
        description,
        sub_agent_id: subAgentId,
        input_schema: inputSchema && Object.keys(inputSchema).length ? inputSchema : { type: 'object', properties: { input: { type: 'string' } }, required: ['input'] },
      },
    },
    logs: [`Agent Tool → exposed ${toolName} → agent ${subAgentId}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_agent_tool',
  name: 'Agent (as tool)',
  description: 'Expose a sub-agent as a callable tool for a parent agent.',
  iconName: 'LuBot',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'expose',
      label: 'Expose sub-agent as tool',
      description: 'Wrap a SabFlow sub-agent with a tool name + description.',
      fields: [
        { id: 'tool_name', label: 'Tool name', type: 'text', required: true, placeholder: 'lookup_customer' },
        {
          id: 'description',
          label: 'Description',
          type: 'textarea',
          required: true,
          placeholder: 'Looks up a customer by email or phone and returns profile + recent orders.',
        },
        { id: 'sub_agent_id', label: 'Sub-agent id', type: 'text', required: true, placeholder: 'agent_customer_lookup' },
        { id: 'input_schema', label: 'Input schema (JSON)', type: 'json', placeholder: '{"type":"object","properties":{"email":{"type":"string"}},"required":["email"]}' },
      ],
      run: expose,
    },
  ],
};

registerForgeBlock(block);
export default block;
