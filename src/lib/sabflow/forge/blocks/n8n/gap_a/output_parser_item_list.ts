/**
 * Forge block: LangChain Output Parser (Item List).
 *
 * Parses LLM output as a numbered (`1.` / `1)`) or bulleted (`-` / `*` / `•`)
 * list. Falls back to splitting on newlines if no list markers are detected.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const NUMBERED_RE = /^\s*(\d+)[.)]\s+(.*\S)\s*$/;
const BULLET_RE = /^\s*[-*•]\s+(.*\S)\s*$/;

function stripFences(s: string): string {
  const fenced = s.match(/```(?:[a-z]+)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : s.trim();
}

function parseList(raw: string): { items: string[]; style: 'numbered' | 'bullet' | 'lines' } {
  const lines = raw.split(/\r?\n/);
  const numbered: string[] = [];
  const bullets: string[] = [];
  for (const line of lines) {
    const nm = line.match(NUMBERED_RE);
    if (nm) numbered.push(nm[2]);
    const bm = line.match(BULLET_RE);
    if (bm) bullets.push(bm[1]);
  }
  if (numbered.length >= bullets.length && numbered.length > 0) {
    return { items: numbered, style: 'numbered' };
  }
  if (bullets.length > 0) {
    return { items: bullets, style: 'bullet' };
  }
  const fallback = lines.map((l) => l.trim()).filter(Boolean);
  return { items: fallback, style: 'lines' };
}

async function parse(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const rawText = asString(ctx.options.raw_text);
  if (!rawText) throw new Error('Output Parser (Item List): raw_text is required');
  const { items, style } = parseList(stripFences(rawText));
  return {
    outputs: { items, count: items.length, style },
    logs: [`Output Parser (Item List) → ${items.length} item(s) [${style}]`],
  };
}

const block: ForgeBlock = {
  id: 'forge_lc_output_parser_item_list',
  name: 'LangChain Output Parser (Item List)',
  description: 'Parse LLM output as a numbered or bulleted list of items.',
  iconName: 'LuList',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'parse',
      label: 'Parse list',
      fields: [
        { id: 'raw_text', label: 'Raw LLM output', type: 'textarea', required: true },
      ],
      run: parse,
    },
  ],
};

registerForgeBlock(block);
export default block;
