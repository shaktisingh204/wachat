/**
 * Forge block: Netlify
 *
 * Source: n8n-master/packages/nodes-base/nodes/Netlify/Netlify.node.ts
 * Credential type: 'netlify' (expects { accessToken }).
 *
 * Operations covered (Netlify API at https://api.netlify.com/api/v1):
 *   - site.list        GET    /sites
 *   - site.get         GET    /sites/{siteId}
 *   - deploy.list      GET    /sites/{siteId}/deploys
 *   - deploy.trigger   POST   /sites/{siteId}/builds   (triggers a new build)
 *
 * Deferred:
 *   - form submissions, env vars, function logs
 *   - file-based deploys (require multipart/zip upload)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const API = 'https://api.netlify.com/api/v1';

function bearer(ctx: ForgeActionContext): string {
  const cred = requireCredential('Netlify', ctx.credential);
  const t = cred.accessToken;
  if (!t) throw new Error('Netlify: credential is missing `accessToken`');
  return `Bearer ${t}`;
}

async function siteList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const name = asString(ctx.options.name);
  const perPage = asString(ctx.options.perPage);
  if (name) params.set('name', name);
  if (perPage) params.set('per_page', perPage);
  const qs = params.toString();

  const res = await apiRequest({
    service: 'Netlify',
    method: 'GET',
    url: `${API}/sites${qs ? `?${qs}` : ''}`,
    headers: { Authorization: bearer(ctx) },
  });
  const sites = Array.isArray(res.data) ? res.data : [];
  return {
    outputs: { sites, count: sites.length },
    logs: [`Netlify site list (${sites.length})`],
  };
}

async function siteGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const siteId = asString(ctx.options.siteId);
  if (!siteId) throw new Error('Netlify: siteId is required');
  const res = await apiRequest({
    service: 'Netlify',
    method: 'GET',
    url: `${API}/sites/${encodeURIComponent(siteId)}`,
    headers: { Authorization: bearer(ctx) },
  });
  return {
    outputs: { site: res.data },
    logs: [`Netlify site get → ${siteId}`],
  };
}

async function deployList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const siteId = asString(ctx.options.siteId);
  if (!siteId) throw new Error('Netlify: siteId is required');
  const params = new URLSearchParams();
  const perPage = asString(ctx.options.perPage);
  if (perPage) params.set('per_page', perPage);
  const qs = params.toString();

  const res = await apiRequest({
    service: 'Netlify',
    method: 'GET',
    url: `${API}/sites/${encodeURIComponent(siteId)}/deploys${qs ? `?${qs}` : ''}`,
    headers: { Authorization: bearer(ctx) },
  });
  const deploys = Array.isArray(res.data) ? res.data : [];
  return {
    outputs: { deploys, count: deploys.length },
    logs: [`Netlify deploy list → ${siteId} (${deploys.length})`],
  };
}

async function deployTrigger(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const siteId = asString(ctx.options.siteId);
  if (!siteId) throw new Error('Netlify: siteId is required');

  const clearCacheRaw = asString(ctx.options.clearCache);
  const payload: Record<string, unknown> = {};
  if (clearCacheRaw === 'true') payload.clear_cache = true;

  const res = await apiRequest({
    service: 'Netlify',
    method: 'POST',
    url: `${API}/sites/${encodeURIComponent(siteId)}/builds`,
    headers: { Authorization: bearer(ctx) },
    json: payload,
  });
  const build = res.data as { id?: string };
  return {
    outputs: { build: res.data },
    logs: [`Netlify build trigger → ${siteId} (${build?.id ?? '?'})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_netlify',
  name: 'Netlify',
  description: 'Read Netlify sites and trigger new deploys.',
  iconName: 'LuRocket',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'netlify' },
  actions: [
    {
      id: 'site_list',
      label: 'List sites',
      description: 'List sites the token can see.',
      fields: [
        { id: 'name', label: 'Name filter', type: 'text' },
        { id: 'perPage', label: 'Per page', type: 'number', placeholder: '20' },
      ],
      run: siteList,
    },
    {
      id: 'site_get',
      label: 'Get site',
      description: 'Fetch metadata for a single site.',
      fields: [
        { id: 'siteId', label: 'Site ID', type: 'text', required: true },
      ],
      run: siteGet,
    },
    {
      id: 'deploy_list',
      label: 'List deploys',
      description: 'List deploys for a site.',
      fields: [
        { id: 'siteId', label: 'Site ID', type: 'text', required: true },
        { id: 'perPage', label: 'Per page', type: 'number', placeholder: '20' },
      ],
      run: deployList,
    },
    {
      id: 'deploy_trigger',
      label: 'Trigger build',
      description: 'Start a new build for a site.',
      fields: [
        { id: 'siteId', label: 'Site ID', type: 'text', required: true },
        {
          id: 'clearCache',
          label: 'Clear cache',
          type: 'select',
          options: [
            { label: 'No', value: 'false' },
            { label: 'Yes', value: 'true' },
          ],
        },
      ],
      run: deployTrigger,
    },
  ],
};

registerForgeBlock(block);
export default block;
