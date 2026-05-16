/**
 * Forge block: Binary Document Loader
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/document_loaders/DocumentBinaryInputLoader
 *
 * Decodes base64 binary data into a string document. JSON format is parsed.
 * PDF/DOCX extraction is deferred — use `forge_read_pdf` for those.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

async function load(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const base64Data = asString(ctx.options.base64Data);
  if (!base64Data) throw new Error('BinaryLoader: base64Data is required');
  const format = (asString(ctx.options.format) || 'text').toLowerCase();

  let decoded: string;
  try {
    decoded = Buffer.from(base64Data, 'base64').toString('utf-8');
  } catch (err) {
    throw new Error(`BinaryLoader: failed to decode base64 — ${(err as Error).message}`);
  }

  let pageContent: unknown = decoded;
  if (format === 'json') {
    try {
      pageContent = JSON.parse(decoded);
    } catch (err) {
      throw new Error(`BinaryLoader: invalid JSON payload — ${(err as Error).message}`);
    }
  }

  const docs = [
    {
      pageContent: typeof pageContent === 'string' ? pageContent : JSON.stringify(pageContent),
      metadata: { format, bytes: decoded.length },
    },
  ];

  return {
    outputs: { documents: docs, count: docs.length },
    logs: [`BinaryLoader → ${decoded.length} byte(s) as ${format}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_doc_loader_binary',
  name: 'Binary Document Loader',
  description: 'Decode base64 binary into a document (text or JSON). For PDF use forge_read_pdf.',
  iconName: 'LuFileBinary',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'load',
      label: 'Load binary',
      description: 'Decode base64 data into a document.',
      fields: [
        { id: 'base64Data', label: 'Base64 data', type: 'textarea', required: true },
        {
          id: 'format',
          label: 'Format',
          type: 'select',
          defaultValue: 'text',
          options: [
            { label: 'Text', value: 'text' },
            { label: 'JSON', value: 'json' },
          ],
        },
      ],
      run: load,
    },
  ],
};

registerForgeBlock(block);
export default block;
