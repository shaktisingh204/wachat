/**
 * Forge block: LangChain Tool — Workflow
 *
 * Source: @n8n/nodes-langchain/nodes/tools/ToolWorkflow/
 *
 * Hands off to another SabFlow workflow by id, passing an input payload
 * (string OR JSON object) as the seed for the called flow's variables.
 * Cross-tenant calls and self-recursion are rejected. Mirrors the engine
 * plumbing in `internals/execute_workflow.ts` but adapted for the agent
 * "tool" surface (single input → flat string output suitable for an LLM).
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';
import { executeFlow } from '@/lib/sabflow/engine';
import { getSabFlowById } from '@/lib/sabflow/db';

/** Parse the agent-supplied `input`: prefer JSON, fall back to `{ input: <string> }`. */
function seedFromInput(raw: string): Record<string, string> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        out[k] = v === null || v === undefined ? '' : String(v);
      }
      return out;
    }
  } catch {
    /* not JSON — fall through */
  }
  return { input: trimmed };
}

async function call(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const workflowId = asString(ctx.options.workflowId).trim();
  const input = asString(ctx.options.input);
  if (!workflowId) throw new Error('Workflow Tool: workflowId is required');
  if (!ctx.userId) {
    throw new Error(
      'Workflow Tool: caller userId is missing — sub-workflow invocation requires authenticated context.',
    );
  }

  // Cycle guard — refuse to call a flow already on the caller stack.
  const stack = ctx.callerStack ?? [];
  if (stack.includes(workflowId)) {
    throw new Error(
      `Workflow Tool: cycle detected — flow "${workflowId}" already in caller stack [${stack.join(' → ')}].`,
    );
  }

  const targetFlow = await getSabFlowById(workflowId);
  if (!targetFlow) {
    throw new Error(`Workflow Tool: target flow "${workflowId}" not found.`);
  }
  if (targetFlow.userId !== ctx.userId) {
    throw new Error(
      `Workflow Tool: target flow "${workflowId}" belongs to a different workspace.`,
    );
  }

  const startGroupId = targetFlow.groups[0]?.id;
  if (!startGroupId) {
    throw new Error(
      `Workflow Tool: target flow "${workflowId}" has no executable groups.`,
    );
  }

  // Seed sub-flow variables: defaults first, then overlay the tool input.
  const seededVars: Record<string, string> = {};
  for (const v of targetFlow.variables ?? []) {
    if (v.defaultValue !== undefined) seededVars[v.name] = String(v.defaultValue);
    else if (v.value !== undefined) seededVars[v.name] = String(v.value);
  }
  for (const [k, v] of Object.entries(seedFromInput(input))) {
    seededVars[k] = v;
  }

  // Forward the caller stack so deeper sub-workflow invocations can detect
  // cycles all the way up.  `runFlowInner` pushes the sub-flow's id on top.
  const { result } = await executeFlow(
    targetFlow,
    {
      flowId: workflowId,
      currentGroupId: startGroupId,
      currentBlockIndex: 0,
      variables: seededVars,
      history: [],
    },
    undefined,
    undefined,
    stack,
  );

  // For the agent-tool path, prefer a flat string output: concatenate the
  // text messages produced by the sub-flow (most useful payload for an LLM).
  // Variables are still returned alongside for blocks that want structured
  // access.
  const textOutput = (result.messages ?? [])
    .filter((m) => m.type === 'text')
    .map((m) => m.content)
    .join('\n')
    .trim();

  return {
    outputs: {
      called: true,
      workflowId,
      output: textOutput,
      isCompleted: result.isCompleted,
      variables: result.updatedVariables,
      messages: result.messages,
    },
    logs: [
      `Workflow Tool → ${workflowId}: ${result.isCompleted ? 'completed' : 'paused'} (${
        result.messages?.length ?? 0
      } message${result.messages?.length === 1 ? '' : 's'})`,
    ],
  };
}

const block: ForgeBlock = {
  id: 'forge_tool_workflow',
  name: 'LangChain Tool — Workflow',
  description: 'Invoke another SabFlow workflow as a tool — passes input, returns concatenated text output.',
  iconName: 'LuWorkflow',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'call',
      label: 'Call workflow',
      fields: [
        {
          id: 'workflowId',
          label: 'Workflow ID',
          type: 'text',
          required: true,
          placeholder: 'flw_abc123',
        },
        {
          id: 'input',
          label: 'Input',
          type: 'textarea',
          placeholder: 'String payload OR JSON object for the called flow',
          helperText:
            'JSON object → seeds matching variables. Plain string → seeds `input`.',
        },
      ],
      run: call,
    },
  ],
};

registerForgeBlock(block);
export default block;
