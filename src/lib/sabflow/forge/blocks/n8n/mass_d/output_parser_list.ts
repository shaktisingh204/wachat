/**
 * Forge block: List Output Parser
 *
 * Parse LLM output into a list of strings. Accepts bullet (- / *), numbered
 * (1. / 1)), or comma/newline separated formats. Configurable delimiter for
 * the fallback path.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asBoolean, asString } from '../_shared/http';

function parseList(text: string, fallbackDelim: string, dedupe: boolean): string[] {
  const t = text.trim();
  let items: string[];
  if (/^[\s]*[-*]/m.test(t) || /^[\s]*\d+[.)]/m.test(t)) {
    items = t
      .split(/\r?\n/)
      .map((s) => s.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
      .filter(Boolean);
  } else if (t.includes('\n')) {
    items = t.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  } else {
    items = t.split(fallbackDelim).map((s) => s.trim()).filter(Boolean);
  }
  if (dedupe) {
    const seen = new Set<string>();
    items = items.filter((x) => (seen.has(x) ? false : (seen.add(x), true)));
  }
  return items;
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  if (!text) throw new Error('List Parser: text is required');
  const delim = asString(ctx.options.delimiter) || ',';
  const dedupe = asBoolean(ctx.options.dedupe);
  const items = parseList(text, delim, dedupe);
  return { outputs: { items, count: items.length }, logs: [`List Parser → ${items.length} item(s)`] };
}

const block: ForgeBlock = {
  id: 'forge_output_parser_list',
  name: 'Output Parser (List)',
  description: 'Parse LLM text into an array. Handles bullets, numbered lists, and delimiter-separated text.',
  iconName: 'LuList',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'parse',
      label: 'Parse list',
      fields: [
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        { id: 'delimiter', label: 'Fallback delimiter', type: 'text', defaultValue: ',' },
        { id: 'dedupe', label: 'Deduplicate', type: 'toggle', defaultValue: false },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
