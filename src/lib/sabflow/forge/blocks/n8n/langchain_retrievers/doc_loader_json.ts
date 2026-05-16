/**
 * Forge block: JSON Document Loader
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/document_loaders/DocumentJsonInputLoader
 *
 * Parses a JSON input. If the parsed value is an array, emit one document per
 * top-level item; otherwise emit a single document wrapping the value.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

function stringify(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

async function load(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const input = asString(ctx.options.input);
  if (!input) throw new Error('JsonLoader: input is required');

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (err) {
    throw new Error(`JsonLoader: invalid JSON — ${(err as Error).message}`);
  }

  const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
  const docs = items.map((item, idx) => ({
    pageContent: stringify(item),
    metadata: { index: idx, source: 'json' },
  }));

  return {
    outputs: { documents: docs, count: docs.length },
    logs: [`JsonLoader → ${docs.length} document(s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_doc_loader_json',
  name: 'JSON Document Loader',
  description: 'Parse JSON and emit one document per top-level item.',
  iconName: 'LuBraces',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'load',
      label: 'Load JSON',
      description: 'Parse JSON into document(s).',
      fields: [
        { id: 'input', label: 'JSON input', type: 'textarea', required: true },
      ],
      run: load,
    },
  ],
};

registerForgeBlock(block);
export default block;
