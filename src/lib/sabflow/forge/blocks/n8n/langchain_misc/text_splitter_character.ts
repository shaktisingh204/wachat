/**
 * Forge block: LangChain Text Splitter (Character)
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/text_splitters/TextSplitterCharacterTextSplitter/
 *
 * Splits text on a separator, then re-joins fragments into chunks no larger
 * than `chunk_size` characters with optional overlap between adjacent chunks.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString } from '../_shared/http';

function unescape(sep: string): string {
  // Allow users to type "\n", "\n\n", "\t" literally.
  return sep
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r');
}

function splitToChunks(text: string, separator: string, chunkSize: number, overlap: number): string[] {
  const parts = separator === '' ? text.split('') : text.split(separator);
  const chunks: string[] = [];
  let buf = '';
  for (const part of parts) {
    const candidate = buf ? `${buf}${separator}${part}` : part;
    if (candidate.length <= chunkSize) {
      buf = candidate;
      continue;
    }
    if (buf) chunks.push(buf);
    // Start next buffer with overlap from previous chunk's tail.
    if (overlap > 0 && buf) {
      const tail = buf.slice(-overlap);
      buf = `${tail}${separator}${part}`;
    } else {
      buf = part;
    }
    // If a single part exceeds chunkSize, hard-slice it.
    while (buf.length > chunkSize) {
      chunks.push(buf.slice(0, chunkSize));
      buf = overlap > 0 ? buf.slice(chunkSize - overlap) : buf.slice(chunkSize);
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  if (!text) throw new Error('Text Splitter (Character): text is required');
  const separator = unescape(asString(ctx.options.separator) || '\n\n');
  const chunkSize = asNumber(ctx.options.chunk_size) ?? 1000;
  const overlap = asNumber(ctx.options.overlap) ?? 0;
  if (chunkSize <= 0) throw new Error('Text Splitter (Character): chunk_size must be > 0');
  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error('Text Splitter (Character): overlap must be 0 ≤ overlap < chunk_size');
  }

  const chunks = splitToChunks(text, separator, chunkSize, overlap);
  return {
    outputs: { chunks, count: chunks.length },
    logs: [`Text Splitter (Character) → ${chunks.length} chunk(s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_text_splitter_character',
  name: 'LangChain Text Splitter (Character)',
  description: 'Split text on a separator and re-join into fixed-size chunks with optional overlap.',
  iconName: 'LuScissors',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'split',
      label: 'Split text by character',
      fields: [
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        { id: 'separator', label: 'Separator', type: 'text', defaultValue: '\\n\\n', helperText: 'Use \\n for newline, \\t for tab.' },
        { id: 'chunk_size', label: 'Chunk size (characters)', type: 'number', defaultValue: 1000 },
        { id: 'overlap', label: 'Chunk overlap', type: 'number', defaultValue: 0 },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
