/**
 * Forge block: Read PDF
 *
 * Source: n8n-master/packages/nodes-base/nodes/ReadPdf/ReadPDF.node.ts
 *
 * Uses `pdf-parse` (v2.x). The output shape mirrors the original v1 API so
 * downstream blocks (and existing workflows) stay compatible:
 *   { text, pages, info, metadata }.
 *
 * Operations covered:
 *   - extract-text-from-url   Fetch a PDF over HTTP and return its text.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function extractTextFromUrl(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('Read PDF: url is required');
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Read PDF: fetch failed (${res.status}) for ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data });
  try {
    const [textResult, infoResult] = await Promise.all([
      parser.getText(),
      parser.getInfo().catch(() => null),
    ]);
    return {
      outputs: {
        text: textResult.text ?? '',
        pages: textResult.total ?? null,
        info: infoResult?.info ?? null,
        metadata: infoResult?.metadata ?? null,
      },
      logs: [`Read PDF extract → ${url} (${textResult.total ?? '?'} pages)`],
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

const block: ForgeBlock = {
  id: 'forge_read_pdf',
  name: 'Read PDF',
  description: 'Download a PDF and extract its text using pdf-parse.',
  iconName: 'LuFileText',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'extract_text_from_url',
      label: 'Extract text from URL',
      description: 'Fetch a PDF over HTTPS and return its text content.',
      fields: [
        {
          id: 'url',
          label: 'PDF URL',
          type: 'text',
          required: true,
          placeholder: 'https://example.com/document.pdf',
        },
      ],
      run: extractTextFromUrl,
    },
  ],
};

registerForgeBlock(block);
export default block;
