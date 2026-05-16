/**
 * Forge block: PDF Document Loader
 *
 * Thin wrapper that delegates to the already-registered `forge_read_pdf`
 * block (n8n's ReadPDF port) via `getForgeBlock`. Exposes the LangChain
 * "document loader" surface: emits one document per page so downstream
 * splitters / vector stores can consume the data the same way they would a
 * `PyPDFLoader` output.
 *
 * Heavy parsing (pdf-parse) only runs inside the delegated block's `run` —
 * this file stays client-safe (no `node:*` imports at module level).
 */

import { getForgeBlock, registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

type PdfPage = { pageNumber?: number; number?: number; text?: string; content?: string };
type PdfOutputs = {
  text?: string;
  pages?: PdfPage[];
  info?: unknown;
  metadata?: unknown;
};

async function load(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('PDF Loader: url is required');

  const target = getForgeBlock('forge_read_pdf');
  if (!target) throw new Error('PDF Loader: forge_read_pdf block is not registered');
  const action = target.actions?.find((a) => a.id === 'extract-text-from-url') ?? target.actions?.[0];
  if (!action) throw new Error('PDF Loader: forge_read_pdf has no actions');

  const inner = await action.run({
    options: { url },
    variables: ctx.variables,
    credential: ctx.credential,
  });
  const outs = (inner.outputs ?? {}) as PdfOutputs;
  const pages = Array.isArray(outs.pages) ? outs.pages : [];
  const documents = pages.map((p, i) => ({
    pageContent: p.text ?? p.content ?? '',
    metadata: {
      source: url,
      page: p.pageNumber ?? p.number ?? i + 1,
    },
  }));
  // Fall back to a single document when the underlying block doesn't return
  // per-page pages (some implementations only return the joined text).
  if (documents.length === 0 && outs.text) {
    documents.push({ pageContent: outs.text, metadata: { source: url, page: 1 } });
  }
  return {
    outputs: {
      documents,
      count: documents.length,
      info: outs.info,
      metadata: outs.metadata,
    },
    logs: [`PDF Loader → ${documents.length} document(s) from ${url}`, ...(inner.logs ?? [])],
  };
}

const block: ForgeBlock = {
  id: 'forge_doc_loader_pdf',
  name: 'Document Loader (PDF)',
  description: 'Fetch a PDF and emit one Document per page (delegates to the Read PDF block).',
  iconName: 'LuFileText',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'load',
      label: 'Load PDF from URL',
      fields: [{ id: 'url', label: 'PDF URL', type: 'text', required: true }],
      run: load,
    },
  ],
};

registerForgeBlock(block);
export default block;
