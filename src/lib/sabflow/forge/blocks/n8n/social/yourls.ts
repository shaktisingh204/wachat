/**
 * Forge block: YOURLS
 *
 * Source: n8n-master/packages/nodes-base/nodes/Yourls/Yourls.node.ts
 * Credential type: 'yourls' (CREDENTIAL_FIELD_SCHEMAS → { baseUrl, signature })
 *
 * The YOURLS API is a single POST endpoint that takes form-encoded params:
 *   POST {baseUrl}/yourls-api.php
 *     signature=<token>&format=json&action=<verb>&...
 *
 * Operations:
 *   - link.shorten   action=shorturl
 *   - link.expand    action=expand
 *   - link.list      action=stats
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function buildEndpoint(ctx: ForgeActionContext): { url: string; signature: string } {
  const cred = requireCredential('YOURLS', ctx.credential);
  const baseUrl = asString(cred.baseUrl).replace(/\/+$/, '');
  const signature = asString(cred.signature);
  if (!baseUrl) throw new Error('YOURLS: credential is missing `baseUrl`');
  if (!signature) throw new Error('YOURLS: credential is missing `signature`');
  return { url: `${baseUrl}/yourls-api.php`, signature };
}

async function yourlsCall(
  ctx: ForgeActionContext,
  params: Record<string, string>,
): Promise<unknown> {
  const { url, signature } = buildEndpoint(ctx);
  const form = new URLSearchParams();
  form.set('signature', signature);
  form.set('format', 'json');
  for (const [k, v] of Object.entries(params)) {
    if (v !== '') form.set(k, v);
  }
  const res = await apiRequest({
    service: 'YOURLS',
    method: 'POST',
    url,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const data = res.data;
  if (data && typeof data === 'object' && (data as { status?: string }).status === 'fail') {
    throw new Error(`YOURLS error: ${(data as { message?: string }).message ?? 'unknown'}`);
  }
  return data;
}

async function linkShorten(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('YOURLS: url is required');
  const data = await yourlsCall(ctx, {
    action: 'shorturl',
    url,
    keyword: asString(ctx.options.keyword),
    title: asString(ctx.options.title),
  });
  return { outputs: { result: data }, logs: [`YOURLS shorten → ${url}`] };
}

async function linkExpand(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const shorturl = asString(ctx.options.shorturl);
  if (!shorturl) throw new Error('YOURLS: shorturl is required');
  const data = await yourlsCall(ctx, { action: 'expand', shorturl });
  return { outputs: { result: data }, logs: [`YOURLS expand → ${shorturl}`] };
}

async function linkList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const filter = asString(ctx.options.filter) || 'top';
  const limit = asString(ctx.options.limit) || '20';
  const data = await yourlsCall(ctx, { action: 'stats', filter, limit });
  return { outputs: { result: data }, logs: [`YOURLS list → ${filter}/${limit}`] };
}

const block: ForgeBlock = {
  id: 'forge_yourls',
  name: 'YOURLS',
  description: 'Self-hosted URL shortener — shorten, expand and list links.',
  iconName: 'LuLink2',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'yourls' },
  actions: [
    {
      id: 'link_shorten',
      label: 'Shorten URL',
      description: 'Create a short URL via the YOURLS shorturl action.',
      fields: [
        { id: 'url', label: 'Long URL', type: 'text', required: true, placeholder: 'https://example.com' },
        { id: 'keyword', label: 'Custom keyword', type: 'text', placeholder: '(optional)' },
        { id: 'title', label: 'Title', type: 'text' },
      ],
      run: linkShorten,
    },
    {
      id: 'link_expand',
      label: 'Expand short URL',
      description: 'Resolve a short URL back to its long form.',
      fields: [
        { id: 'shorturl', label: 'Short URL or keyword', type: 'text', required: true },
      ],
      run: linkExpand,
    },
    {
      id: 'link_list',
      label: 'List links (stats)',
      description: 'List recent links via the YOURLS stats action.',
      fields: [
        {
          id: 'filter',
          label: 'Filter',
          type: 'select',
          options: [
            { label: 'Top', value: 'top' },
            { label: 'Bottom', value: 'bottom' },
            { label: 'Random', value: 'rand' },
            { label: 'Last', value: 'last' },
          ],
          defaultValue: 'top',
        },
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: '20' },
      ],
      run: linkList,
    },
  ],
};

registerForgeBlock(block);
export default block;
