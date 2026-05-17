/**
 * Forge block: LangChain Model Selector
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/ModelSelector/
 *
 * Picks one of N upstream language-model connections based on a rule.
 * In SabFlow this is a routing primitive — the engine evaluates `rules[]`
 * top-to-bottom and emits the first matching `modelId` for the downstream
 * agent to consume. No external API calls.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';
import { parseJsonArray } from '../_shared/json';

type SelectorRule = { modelId: string; when: string };

function evaluateRule(expr: string, ctxValue: string): boolean {
  if (!expr || expr === '*' || expr === 'true') return true;
  if (expr.startsWith('=')) return ctxValue === expr.slice(1);
  if (expr.startsWith('~')) return ctxValue.includes(expr.slice(1));
  if (expr.startsWith('!=')) return ctxValue !== expr.slice(2);
  return ctxValue === expr;
}

async function select(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const rules = parseJsonArray(ctx.options.rules, 'Model Selector: rules') as SelectorRule[];
  const contextValue = asString(ctx.options.context_value);
  const fallback = asString(ctx.options.fallback_model);
  if (!Array.isArray(rules) || rules.length === 0) {
    if (!fallback) throw new Error('Model Selector: no rules and no fallback_model');
    return { outputs: { modelId: fallback, matched: 'fallback' }, logs: ['Model Selector → fallback'] };
  }
  for (const r of rules) {
    if (!r || typeof r !== 'object') continue;
    if (evaluateRule(asString(r.when), contextValue)) {
      return { outputs: { modelId: r.modelId, matched: r.when }, logs: [`Model Selector → ${r.modelId} (rule: ${r.when})`] };
    }
  }
  if (!fallback) throw new Error('Model Selector: no rule matched and no fallback_model');
  return { outputs: { modelId: fallback, matched: 'fallback' }, logs: ['Model Selector → fallback (no match)'] };
}

const block: ForgeBlock = {
  id: 'forge_model_selector',
  name: 'Model Selector',
  description: 'Route an agent call to one of several language models based on rules.',
  iconName: 'LuGitFork',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'select',
      label: 'Select model',
      description: 'Evaluate rules and emit the chosen modelId.',
      fields: [
        {
          id: 'rules',
          label: 'Rules (JSON array)',
          type: 'json',
          required: true,
          placeholder: '[{"modelId":"gpt-4o","when":"~urgent"},{"modelId":"gpt-4o-mini","when":"*"}]',
        },
        { id: 'context_value', label: 'Context value', type: 'text', placeholder: 'value matched against rule.when' },
        { id: 'fallback_model', label: 'Fallback model', type: 'text', placeholder: 'gpt-4o-mini' },
      ],
      run: select,
    },
  ],
};

registerForgeBlock(block);
export default block;
