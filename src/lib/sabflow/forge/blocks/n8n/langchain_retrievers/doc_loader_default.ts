/**
 * Forge block: Default Document Loader
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/document_loaders/DocumentDefaultDataLoader
 *
 * Wraps any string input as a single document object suitable for downstream
 * retrievers / vector stores.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

async function load(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const input = asString(ctx.options.input);
  if (!input) throw new Error('DefaultLoader: input is required');
  const source = asString(ctx.options.source);

  const docs = [
    {
      pageContent: input,
      metadata: { source: source || 'inline', length: input.length },
    },
  ];

  return {
    outputs: { documents: docs, count: docs.length },
    logs: [`DefaultLoader → 1 document (${input.length} chars)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_doc_loader_default',
  name: 'Default Document Loader',
  description: 'Wrap a string input as a single document.',
  iconName: 'LuFileText',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'load',
      label: 'Load text',
      description: 'Wrap a string as a document.',
      fields: [
        { id: 'input', label: 'Input', type: 'textarea', required: true },
        { id: 'source', label: 'Source label (metadata)', type: 'text' },
      ],
      run: load,
    },
  ],
};

registerForgeBlock(block);
export default block;
