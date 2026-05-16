/**
 * Forge block: URLScan.io
 *
 * Source: n8n-master/packages/nodes-base/nodes/UrlScanIo/UrlScanIo.node.ts
 *
 * API key passed inline as a `password` field (Wave 12 policy). Sent via
 * `API-Key` header.
 *
 * Operations covered:
 *   - scan.submit          POST /scan
 *   - scan.get             GET  /result/{uuid}
 *   - scan.search          GET  /search/?q=…
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://urlscan.io/api/v1';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.apiKey);
  if (!key) throw new Error('URLScan.io: apiKey is required');
  return { 'API-Key': key };
}

async function scanSubmit(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('URLScan.io: url is required');
  const visibility = asString(ctx.options.visibility) || 'public';
  const tags = asString(ctx.options.tags)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const res = await apiRequest({
    service: 'URLScan.io',
    method: 'POST',
    url: `${API}/scan/`,
    headers: authHeader(ctx),
    json: {
      url,
      visibility,
      ...(tags.length ? { tags } : {}),
    },
  });
  return {
    outputs: { submission: res.data },
    logs: [`URLScan.io scan submit → ${url}`],
  };
}

async function scanGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const uuid = asString(ctx.options.uuid);
  if (!uuid) throw new Error('URLScan.io: uuid is required');
  const res = await apiRequest({
    service: 'URLScan.io',
    method: 'GET',
    url: `${API}/result/${encodeURIComponent(uuid)}/`,
    headers: authHeader(ctx),
  });
  return {
    outputs: { scan: res.data },
    logs: [`URLScan.io scan get → ${uuid}`],
  };
}

async function scanSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const q = asString(ctx.options.query);
  if (!q) throw new Error('URLScan.io: query is required');
  const size = asString(ctx.options.size) || '100';
  const qs = new URLSearchParams({ q, size }).toString();
  const res = await apiRequest({
    service: 'URLScan.io',
    method: 'GET',
    url: `${API}/search/?${qs}`,
    headers: authHeader(ctx),
  });
  return {
    outputs: { results: res.data },
    logs: [`URLScan.io search → ${q}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_urlscanio',
  name: 'URLScan.io',
  description: 'Submit URL scans and fetch threat intelligence results from urlscan.io.',
  iconName: 'LuScan',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'scan_submit',
      label: 'Submit scan',
      description: 'Submit a URL for scanning.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://example.com' },
        {
          id: 'visibility',
          label: 'Visibility',
          type: 'select',
          options: [
            { label: 'Public', value: 'public' },
            { label: 'Unlisted', value: 'unlisted' },
            { label: 'Private', value: 'private' },
          ],
          defaultValue: 'public',
        },
        { id: 'tags', label: 'Tags (comma-separated)', type: 'text', placeholder: 'phishing,malware' },
      ],
      run: scanSubmit,
    },
    {
      id: 'scan_get',
      label: 'Get scan result',
      description: 'Fetch the result of a previously submitted scan.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'uuid', label: 'Scan UUID', type: 'text', required: true },
      ],
      run: scanGet,
    },
    {
      id: 'scan_search',
      label: 'Search scans',
      description: 'Search the public urlscan.io scan archive.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'query', label: 'Query', type: 'text', required: true, placeholder: 'domain:example.com' },
        { id: 'size', label: 'Page size', type: 'number', defaultValue: '100' },
      ],
      run: scanSearch,
    },
  ],
};

registerForgeBlock(block);
export default block;
