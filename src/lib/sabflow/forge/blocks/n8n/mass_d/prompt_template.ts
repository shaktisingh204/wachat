/**
 * Forge block: Prompt Template
 *
 * Render a template string with `{{var}}` substitutions. Variables come from
 * a JSON map (or are merged from flow variables if `useFlowVars` is on).
 * Optionally enforce required variables.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asBoolean, asString } from '../_shared/http';

function extractVars(template: string): string[] {
  const out = new Set<string>();
  const re = /\{\{\s*([A-Za-z_][\w.]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) out.add(m[1]);
  return Array.from(out);
}

function render(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([A-Za-z_][\w.]*)\s*\}\}/g, (_, key: string) => {
    const v = key.split('.').reduce<unknown>((acc, k) => {
      if (acc && typeof acc === 'object' && k in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[k];
      }
      return undefined;
    }, vars);
    if (v === undefined || v === null) return '';
    return typeof v === 'string' ? v : JSON.stringify(v);
  });
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const template = asString(ctx.options.template);
  if (!template) throw new Error('Prompt Template: template is required');
  const useFlowVars = asBoolean(ctx.options.useFlowVars);
  const strict = asBoolean(ctx.options.strict);

  let vars: Record<string, unknown> = {};
  const raw = ctx.options.vars;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') vars = parsed as Record<string, unknown>;
    } catch {
      throw new Error('Prompt Template: vars must be valid JSON');
    }
  } else if (raw && typeof raw === 'object') {
    vars = raw as Record<string, unknown>;
  }
  if (useFlowVars) vars = { ...ctx.variables, ...vars };

  const required = extractVars(template);
  if (strict) {
    const missing = required.filter((k) => {
      const v = k.split('.').reduce<unknown>((acc, kk) => {
        if (acc && typeof acc === 'object' && kk in (acc as Record<string, unknown>)) {
          return (acc as Record<string, unknown>)[kk];
        }
        return undefined;
      }, vars);
      return v === undefined || v === null || v === '';
    });
    if (missing.length > 0) throw new Error(`Prompt Template: missing required vars — ${missing.join(', ')}`);
  }

  const text = render(template, vars);
  return { outputs: { text, vars: required }, logs: [`Prompt Template → ${text.length} chars`] };
}

const block: ForgeBlock = {
  id: 'forge_prompt_template',
  name: 'Prompt Template',
  description: 'Render a {{variable}}-substituted template. Optionally merge flow variables and enforce strict required vars.',
  iconName: 'LuFileText',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'render',
      label: 'Render template',
      fields: [
        { id: 'template', label: 'Template ({{var}})', type: 'textarea', required: true },
        { id: 'vars', label: 'Variables (JSON object)', type: 'json' },
        { id: 'useFlowVars', label: 'Merge flow variables', type: 'toggle', defaultValue: false },
        { id: 'strict', label: 'Throw on missing vars', type: 'toggle', defaultValue: false },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
