/**
 * Forge block: URL Document Loader
 *
 * Fetch a URL and produce a single LangChain-style Document. If the response
 * is JSON, the pretty-printed JSON becomes the document content; if it's
 * HTML, tags are stripped for a rough text view (set `stripHtml` to false
 * to keep raw HTML).
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asBoolean, asString } from '../_shared/http';

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function load(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('URL Loader: url is required');
  const stripHtml = ctx.options.stripHtml === undefined ? true : asBoolean(ctx.options.stripHtml);
  const headersRaw = ctx.options.headers;
  let headers: Record<string, string> = { Accept: 'text/html,application/json,text/plain,*/*' };
  if (typeof headersRaw === 'string' && headersRaw.trim()) {
    try {
      const parsed = JSON.parse(headersRaw);
      if (parsed && typeof parsed === 'object') headers = { ...headers, ...(parsed as Record<string, string>) };
    } catch {
      throw new Error('URL Loader: headers must be valid JSON');
    }
  } else if (headersRaw && typeof headersRaw === 'object') {
    headers = { ...headers, ...(headersRaw as Record<string, string>) };
  }

  const res = await apiRequest({ service: 'URL Loader', method: 'GET', url, headers });
  const contentType = res.headers.get('content-type') ?? '';
  let pageContent: string;
  if (contentType.includes('json')) {
    pageContent = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
  } else if (contentType.includes('html') && stripHtml) {
    pageContent = htmlToText(res.text);
  } else {
    pageContent = res.text;
  }
  const document = {
    pageContent,
    metadata: {
      source: url,
      contentType,
      status: res.status,
      length: pageContent.length,
    },
  };
  return {
    outputs: { documents: [document], count: 1 },
    logs: [`URL Loader → ${pageContent.length} chars from ${url}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_doc_loader_url',
  name: 'Document Loader (URL)',
  description: 'Fetch a URL and emit a single Document (HTML stripped to text, JSON pretty-printed).',
  iconName: 'LuLink',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'load',
      label: 'Load URL',
      fields: [
        { id: 'url', label: 'URL', type: 'text', required: true },
        { id: 'stripHtml', label: 'Strip HTML tags', type: 'toggle', defaultValue: true },
        { id: 'headers', label: 'Extra headers (JSON)', type: 'json' },
      ],
      run: load,
    },
  ],
};

registerForgeBlock(block);
export default block;
