/**
 * Forge block: Agent Tool.
 *
 * Lightweight alternative to the full "Run AI Agent" block. Instead of
 * spinning up an LLM round-trip loop, this block invokes a single registered
 * agent tool directly with a pre-shaped argument object — useful when the
 * flow already knows exactly which tool it needs (e.g. `search_contacts` with
 * a specific query) and doesn't want to pay for model latency.
 *
 * Fields
 *  - `toolName`    — dropdown sourced from the agent tool registry
 *  - `argsJson`    — JSON object passed as the tool's `args` (after variable
 *                    substitution)
 *  - `outputVariable` — variable id/name that receives the tool's result
 */

import { registerForgeBlock } from '../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
  ForgeSelectOption,
} from '../types';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const str = (v: unknown): string =>
  typeof v === 'string' ? v : v == null ? '' : String(v);

/**
 * Static fallback. The settings panel fetches the live tool registry via a
 * server action; we keep this list isomorphic-safe so forge can register on
 * the client without pulling `@/lib/agents` (which is `server-only`).
 */
function buildToolOptions(): ForgeSelectOption[] {
  return [
    { value: 'search_contacts', label: 'search_contacts — search CRM contacts' },
    { value: 'send_whatsapp', label: 'send_whatsapp — queue a WhatsApp message' },
    { value: 'create_crm_deal', label: 'create_crm_deal — create a CRM deal' },
    { value: 'query_analytics', label: 'query_analytics — aggregate metrics' },
    { value: 'update_variable', label: 'update_variable — set a variable' },
  ];
}

function parseArgs(raw: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (!raw.trim()) return { ok: true, value: {} };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ok: true, value: parsed as Record<string, unknown> };
    }
    return { ok: false, error: 'argsJson must be a JSON object' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ── Action runtime ──────────────────────────────────────────────────────── */

async function runToolAction(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const opts = ctx.options as Record<string, unknown>;
  const toolName = str(opts.toolName);
  const outputVariable = str(opts.outputVariable);
  const parsed = parseArgs(str(opts.argsJson));

  if (!toolName) {
    return {
      logs: ['agent-tool: toolName is required'],
      outputs: outputVariable ? { [outputVariable]: '' } : undefined,
    };
  }
  if (!parsed.ok) {
    return {
      logs: [`agent-tool: invalid argsJson — ${parsed.error}`],
      outputs: outputVariable ? { [outputVariable]: '' } : undefined,
    };
  }

  // Resolve the tool through the agents module. Falls back gracefully when
  // Impl 4 hasn't shipped yet.
  // The `typeof window === 'undefined'` guard keeps webpack/turbopack from
  // bundling `@/lib/agents` (and its mongodb/genkit deps) into client chunks.
  let tool: { name: string; run: (args: unknown, ctx: unknown) => Promise<unknown> } | undefined;
  if (typeof window === 'undefined') {
    try {
      const mod = (await import('@/lib/agents')) as {
        getTool?: (name: string) => typeof tool;
      };
      if (typeof mod.getTool === 'function') tool = mod.getTool(toolName);
    } catch {
      // module unavailable
    }
  }

  if (!tool) {
    console.warn(
      `[forge_agent_tool] tool '${toolName}' unavailable — @/lib/agents not loaded.`,
    );
    return {
      logs: [`agent-tool: stub run for '${toolName}' (agents module missing).`],
      outputs: outputVariable ? { [outputVariable]: '' } : undefined,
    };
  }

  try {
    const result = await tool.run(parsed.value, {
      runId: 'sabflow-inline',
      agentId: 'sabflow-inline',
      shortTerm: new Map(),
      toolCallsRemaining: 1,
      trace: () => undefined,
    });
    const outputs: Record<string, unknown> = {};
    if (outputVariable) outputs[outputVariable] = result;
    return {
      outputs,
      logs: [`agent-tool: ${toolName} ran successfully`],
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return {
      outputs: outputVariable ? { [outputVariable]: '' } : undefined,
      logs: [`agent-tool: ${toolName} failed — ${err}`],
    };
  }
}

/* ── Forge block registration ────────────────────────────────────────────── */

const block: ForgeBlock = {
  id: 'forge_agent_tool',
  name: 'Agent Tool',
  description:
    'Invoke a single agent tool inline, without launching a full LLM run.',
  iconName: 'LuWrench',
  category: 'Integration',
  fields: [
    {
      id: 'toolName',
      label: 'Tool',
      type: 'select',
      required: true,
      options: buildToolOptions(),
      helperText: 'Pick a registered agent tool.',
    },
    {
      id: 'argsJson',
      label: 'Arguments (JSON)',
      type: 'json',
      placeholder: '{"query": "{{search_query}}", "limit": 5}',
      helperText: 'JSON object — {{variable}} tokens are resolved at runtime.',
    },
    {
      id: 'outputVariable',
      label: 'Save result to',
      type: 'variable',
      helperText: 'Flow variable that receives the tool\'s return value.',
    },
  ],
  actions: [
    {
      id: 'run',
      label: 'Run tool',
      description: 'Invoke the selected tool with the parsed argument object.',
      fields: [],
      run: runToolAction,
    },
  ],
};

registerForgeBlock(block);

export default block;
