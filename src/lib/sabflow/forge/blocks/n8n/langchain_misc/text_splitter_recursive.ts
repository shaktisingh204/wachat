/**
 * Forge block: LangChain Text Splitter (Recursive Character)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/text_splitters/TextSplitterRecursiveCharacterTextSplitter/
 *
 * LangChain's canonical splitter: try separators in order (paragraph → line →
 * space → char), recursing into oversized fragments until every chunk fits.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString } from '../_shared/http';

const DEFAULT_SEPARATORS = ['\n\n', '\n', ' ', ''];

function splitOn(text: string, sep: string): string[] {
  if (sep === '') return Array.from(text);
  return text.split(sep);
}

function mergeChunks(pieces: string[], joiner: string, chunkSize: number, overlap: number): string[] {
  const out: string[] = [];
  let buf = '';
  for (const piece of pieces) {
    const candidate = buf ? `${buf}${joiner}${piece}` : piece;
    if (candidate.length <= chunkSize) {
      buf = candidate;
      continue;
    }
    if (buf) out.push(buf);
    if (overlap > 0 && buf) {
      const tail = buf.slice(-overlap);
      buf = `${tail}${joiner}${piece}`;
    } else {
      buf = piece;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function recursiveSplit(text: string, chunkSize: number, overlap: number, separators: string[]): string[] {
  if (text.length <= chunkSize) return [text];
  for (let i = 0; i < separators.length; i++) {
    const sep = separators[i];
    const pieces = splitOn(text, sep);
    if (pieces.length === 1) continue; // separator didn't match — try next
    const merged = mergeChunks(pieces, sep, chunkSize, overlap);
    // For any oversized merged chunk, recurse with the remaining separators.
    const out: string[] = [];
    for (const chunk of merged) {
      if (chunk.length <= chunkSize) {
        out.push(chunk);
      } else {
        const rest = recursiveSplit(chunk, chunkSize, overlap, separators.slice(i + 1));
        out.push(...rest);
      }
    }
    return out;
  }
  // Fallback hard slice.
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    out.push(text.slice(i, i + chunkSize));
    i += Math.max(1, chunkSize - overlap);
  }
  return out;
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  if (!text) throw new Error('Text Splitter (Recursive): text is required');
  const chunkSize = asNumber(ctx.options.chunk_size) ?? 1000;
  const overlap = asNumber(ctx.options.overlap) ?? 0;
  if (chunkSize <= 0) throw new Error('Text Splitter (Recursive): chunk_size must be > 0');
  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error('Text Splitter (Recursive): overlap must be 0 ≤ overlap < chunk_size');
  }

  const chunks = recursiveSplit(text, chunkSize, overlap, DEFAULT_SEPARATORS);
  return {
    outputs: { chunks, count: chunks.length },
    logs: [`Text Splitter (Recursive) → ${chunks.length} chunk(s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_text_splitter_recursive',
  name: 'LangChain Text Splitter (Recursive)',
  description: 'Recursively split text by paragraph → line → space → character until chunks fit.',
  iconName: 'LuListTree',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'split',
      label: 'Recursively split text',
      fields: [
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        { id: 'chunk_size', label: 'Chunk size (characters)', type: 'number', defaultValue: 1000 },
        { id: 'overlap', label: 'Chunk overlap', type: 'number', defaultValue: 0 },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
