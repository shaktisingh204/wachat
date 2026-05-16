/**
 * Forge block: LangChain Text Splitter (Token)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/text_splitters/TextSplitterTokenSplitter/
 *
 * Approximates token-count splitting using a 4-characters-per-token heuristic
 * — close enough for OpenAI's BPE tokenizers without bundling tiktoken.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString } from '../_shared/http';

const CHARS_PER_TOKEN = 4;

function approxTokens(s: string): number {
  return Math.ceil(s.length / CHARS_PER_TOKEN);
}

function splitByTokens(text: string, maxTokens: number, overlapTokens: number): string[] {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return [text];
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(text.length, i + maxChars);
    out.push(text.slice(i, end));
    if (end >= text.length) break;
    i = end - overlapChars;
    if (i <= 0) i = end;
  }
  return out;
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  if (!text) throw new Error('Text Splitter (Token): text is required');
  const maxTokens = asNumber(ctx.options.max_tokens) ?? 256;
  const overlap = asNumber(ctx.options.overlap) ?? 0;
  if (maxTokens <= 0) throw new Error('Text Splitter (Token): max_tokens must be > 0');
  if (overlap < 0 || overlap >= maxTokens) {
    throw new Error('Text Splitter (Token): overlap must be 0 ≤ overlap < max_tokens');
  }

  const chunks = splitByTokens(text, maxTokens, overlap);
  const tokenCounts = chunks.map(approxTokens);
  return {
    outputs: {
      chunks,
      count: chunks.length,
      approx_tokens_per_chunk: tokenCounts,
      total_approx_tokens: tokenCounts.reduce((a, b) => a + b, 0),
    },
    logs: [`Text Splitter (Token) → ${chunks.length} chunk(s) at ~${maxTokens} tokens each`],
  };
}

const block: ForgeBlock = {
  id: 'forge_text_splitter_token',
  name: 'LangChain Text Splitter (Token)',
  description: 'Approximate token-count splitter using a 4-chars-per-token heuristic.',
  iconName: 'LuHash',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'split',
      label: 'Split text by token count',
      fields: [
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        { id: 'max_tokens', label: 'Max tokens per chunk', type: 'number', defaultValue: 256 },
        { id: 'overlap', label: 'Token overlap', type: 'number', defaultValue: 0 },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
