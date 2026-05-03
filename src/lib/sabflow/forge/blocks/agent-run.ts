/**
 * Forge block: Run AI Agent.
 *
 * Single-action block that invokes a registered AI agent through the
 * `agent-bridge` and writes the agent's final output into a flow variable.
 *
 * Fields
 *  - `agentId`         — dropdown sourced from the agent registry
 *  - `inputTemplate`   — free-text template; supports {{variable}} tokens
 *  - `outputVariable`  — variable id/name receiving `agent.output`
 *  - `timeoutMs`       — optional per-call wall-clock budget
 *  - `maxCostCents`    — optional per-call cost ceiling in USD-cents
 */

import { registerForgeBlock } from '../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
  ForgeSelectOption,
} from '../types';
import {
  runAgentInFlow,
  type AgentBlockOptions,
} from '../../agent-bridge';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const str = (v: unknown): string =>
  typeof v === 'string' ? v : v == null ? '' : String(v);

const numOrUndef = (v: unknown): number | undefined => {
  if (v === '' || v == null) return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Static dropdown for the agent registration dialog.
 *
 * We deliberately do NOT touch `@/lib/agents` at registration time: that module
 * is `server-only`, and forge block registration runs in both the server and
 * client bundles. A static list keeps the client bundle clean; the settings
 * panel refreshes the dropdown at edit time via a server action.
 */
function buildAgentOptions(): ForgeSelectOption[] {
  return [
    { value: 'sales-sdr', label: 'Sales SDR' },
    { value: 'support-triage', label: 'Support Triage' },
    { value: 'copywriter', label: 'Copywriter' },
  ];
}

/* ── Action runtime ──────────────────────────────────────────────────────── */

async function runAgentAction(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const opts = ctx.options as Record<string, unknown>;
  const blockOptions: AgentBlockOptions = {
    agentId: str(opts.agentId),
    inputTemplate: str(opts.inputTemplate),
    outputVariable: str(opts.outputVariable),
    timeoutMs: numOrUndef(opts.timeoutMs),
    maxCostCents: numOrUndef(opts.maxCostCents),
  };

  // Variables come pre-stringified at the engine boundary.
  const variables: Record<string, string> = {};
  for (const [k, v] of Object.entries(ctx.variables ?? {})) {
    variables[k] = typeof v === 'string' ? v : v == null ? '' : String(v);
  }

  const result = await runAgentInFlow(blockOptions, { variables });

  const outputs: Record<string, unknown> = {};
  if (blockOptions.outputVariable) {
    outputs[blockOptions.outputVariable] = result.output;
  }
  // Surface metadata variables for downstream blocks.
  outputs['__agent_run_id'] = result.agentRunId;
  outputs['__agent_cost_cents'] = result.cost;
  if (result.error) outputs['__agent_error'] = result.error;

  const logs: string[] = [];
  if (result.stubbed) logs.push('Agent runner stubbed: @/lib/agents not available.');
  if (result.error) logs.push(`Agent error: ${result.error}`);
  logs.push(`Agent ${blockOptions.agentId} → ${result.output.slice(0, 120)}`);

  return { outputs, logs };
}

/* ── Forge block registration ────────────────────────────────────────────── */

const block: ForgeBlock = {
  id: 'forge_agent_run',
  name: 'Run AI Agent',
  description:
    'Invoke a SabNode AI agent and store its final output in a flow variable.',
  iconName: 'LuBot',
  category: 'Integration',
  fields: [
    {
      id: 'agentId',
      label: 'Agent',
      type: 'select',
      required: true,
      options: buildAgentOptions(),
      helperText: 'Pick a registered agent. New agents are auto-discovered.',
    },
    {
      id: 'inputTemplate',
      label: 'Input',
      type: 'textarea',
      placeholder: 'Hi, please handle {{contact_name}} who said {{last_message}}',
      helperText: 'Use {{variable}} placeholders. The result becomes the agent prompt.',
      required: true,
    },
    {
      id: 'outputVariable',
      label: 'Save output to',
      type: 'variable',
      helperText: 'Flow variable that will hold the agent\'s final answer.',
    },
    {
      id: 'timeoutMs',
      label: 'Timeout (ms)',
      type: 'number',
      defaultValue: 60000,
      helperText: 'Max wall-clock time for the agent run.',
    },
    {
      id: 'maxCostCents',
      label: 'Max cost (¢)',
      type: 'number',
      defaultValue: 50,
      helperText: 'Cap the agent\'s spend in USD-cents.',
    },
  ],
  actions: [
    {
      id: 'run',
      label: 'Run agent',
      description: 'Invoke the agent and write its output into a flow variable.',
      fields: [],
      run: runAgentAction,
    },
  ],
};

registerForgeBlock(block);

export default block;
