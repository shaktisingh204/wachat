/**
 * Forge block: Agent Conditional.
 *
 * Branch block where an LLM picks which downstream edge to take based on a
 * user-supplied prompt. The agent is instructed to answer with exactly ONE of
 * the configured branch labels, and the bridge layer maps the answer back to
 * an edge.
 *
 * Fields
 *  - `agentId`         — the classifier agent (defaults to a single-shot
 *                        instruction-following agent if available)
 *  - `decisionPrompt`  — prompt explaining the decision; supports {{var}}
 *  - `branchLabels`    — comma-separated list of allowed labels
 *  - `outputVariable`  — variable id/name that receives the chosen label
 *  - `timeoutMs` / `maxCostCents` — budget knobs
 *
 * Note: the engine's edge-routing is driven by `block.outgoingEdgeId` and the
 * `items[*].outgoingEdgeId` mappings (see `condition` block in the engine).
 * Wiring up edge-per-label is the canvas layer's job; this forge block writes
 * the chosen label into a flow variable and exposes it as `outputs.branch`,
 * which the canvas can use to seed an `outgoingEdgeId` lookup.
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

function parseLabels(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Isomorphic-safe static list. See agent-run.ts for the rationale. */
function buildAgentOptions(): ForgeSelectOption[] {
  return [
    { value: 'classifier', label: 'Classifier' },
    { value: 'support-triage', label: 'Support Triage' },
  ];
}

/* ── Action runtime ──────────────────────────────────────────────────────── */

async function runDecisionAction(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const opts = ctx.options as Record<string, unknown>;
  const labels = parseLabels(str(opts.branchLabels));

  if (labels.length === 0) {
    return {
      logs: ['agent-conditional: no branch labels configured'],
    };
  }

  // Wrap the user prompt with strict formatting instructions so the LLM
  // emits a single label.
  const promptBody = str(opts.decisionPrompt);
  const wrapped =
    `${promptBody}\n\n` +
    `You must respond with EXACTLY ONE of the following labels and nothing else:\n` +
    labels.map((l) => `- ${l}`).join('\n');

  const blockOptions: AgentBlockOptions = {
    agentId: str(opts.agentId),
    inputTemplate: wrapped,
    timeoutMs: numOrUndef(opts.timeoutMs),
    maxCostCents: numOrUndef(opts.maxCostCents),
    branchMode: true,
    branchLabels: labels,
  };

  const variables: Record<string, string> = {};
  for (const [k, v] of Object.entries(ctx.variables ?? {})) {
    variables[k] = typeof v === 'string' ? v : v == null ? '' : String(v);
  }

  const result = await runAgentInFlow(blockOptions, { variables });
  const chosen = result.branchLabel ?? labels[0];

  const outputs: Record<string, unknown> = {
    branch: chosen,
    __agent_branch_label: chosen,
    __agent_run_id: result.agentRunId,
    __agent_cost_cents: result.cost,
  };

  const outputVariable = str(opts.outputVariable);
  if (outputVariable) outputs[outputVariable] = chosen;

  const logs: string[] = [];
  if (result.error) logs.push(`Agent error: ${result.error}`);
  logs.push(`Agent picked branch: ${chosen}`);

  return { outputs, logs };
}

/* ── Forge block registration ────────────────────────────────────────────── */

const block: ForgeBlock = {
  id: 'forge_agent_conditional',
  name: 'Agent Conditional',
  description:
    'Let an AI agent pick which outgoing edge to take based on a prompt.',
  iconName: 'LuGitBranch',
  category: 'Logic',
  fields: [
    {
      id: 'agentId',
      label: 'Classifier agent',
      type: 'select',
      required: true,
      options: buildAgentOptions(),
    },
    {
      id: 'decisionPrompt',
      label: 'Decision prompt',
      type: 'textarea',
      placeholder:
        'Read the customer message {{last_message}}. Classify intent.',
      required: true,
      helperText: 'Variable tokens are resolved before the agent runs.',
    },
    {
      id: 'branchLabels',
      label: 'Branch labels',
      type: 'text',
      placeholder: 'billing, sales, support',
      required: true,
      helperText: 'Comma-separated list — each becomes a possible output edge.',
    },
    {
      id: 'outputVariable',
      label: 'Save chosen label to',
      type: 'variable',
      helperText: 'Flow variable that receives the picked label (optional).',
    },
    {
      id: 'timeoutMs',
      label: 'Timeout (ms)',
      type: 'number',
      defaultValue: 30000,
    },
    {
      id: 'maxCostCents',
      label: 'Max cost (¢)',
      type: 'number',
      defaultValue: 5,
    },
  ],
  actions: [
    {
      id: 'decide',
      label: 'Decide branch',
      description: 'Run the agent and pick a branch label.',
      fields: [],
      run: runDecisionAction,
    },
  ],
};

registerForgeBlock(block);

export default block;
