/**
 * Forge block: Facebook Graph API
 *
 * Source: n8n-master/packages/nodes-base/nodes/Facebook/FacebookGraphApi.node.ts
 *
 * Generic Graph API wrapper — access token used as `access_token` query param.
 *
 * Operations covered:
 *   - node.get       GET    /{version}/{node}[/edge]
 *   - node.post      POST   /{version}/{node}[/edge]
 *   - node.delete    DELETE /{version}/{node}[/edge]
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function buildUrl(ctx: ForgeActionContext): { url: string; accessToken: string } {
  const accessToken = asString(ctx.options.accessToken);
  if (!accessToken) throw new Error('Facebook: accessToken is required');
  const host = asString(ctx.options.hostUrl) || 'graph.facebook.com';
  const version = asString(ctx.options.graphApiVersion);
  const node = asString(ctx.options.node);
  if (!node) throw new Error('Facebook: node is required');
  const edge = asString(ctx.options.edge);
  const versionPart = version ? `${version}/` : '';
  const edgePart = edge ? `/${edge}` : '';
  return {
    url: `https://${host}/${versionPart}${node}${edgePart}`,
    accessToken,
  };
}

function appendQuery(url: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params);
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${qs.toString()}`;
}

function parseExtraQuery(ctx: ForgeActionContext): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = asString(ctx.options.queryParams);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          out[k] = typeof v === 'string' ? v : JSON.stringify(v);
        }
      }
    } catch {
      throw new Error('Facebook: queryParams must be valid JSON');
    }
  }
  const fields = asString(ctx.options.fields);
  if (fields) out.fields = fields;
  return out;
}

async function nodeGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { url, accessToken } = buildUrl(ctx);
  const params = { access_token: accessToken, ...parseExtraQuery(ctx) };
  const res = await apiRequest({
    service: 'Facebook',
    method: 'GET',
    url: appendQuery(url, params),
    headers: { Accept: 'application/json' },
  });
  return { outputs: { result: res.data }, logs: [`Facebook GET ${url}`] };
}

async function nodePost(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { url, accessToken } = buildUrl(ctx);
  const finalUrl = appendQuery(url, { access_token: accessToken });
  const bodyStr = asString(ctx.options.body);
  let json: unknown = {};
  if (bodyStr) {
    try {
      json = JSON.parse(bodyStr);
    } catch {
      throw new Error('Facebook: body must be valid JSON');
    }
  }
  const res = await apiRequest({
    service: 'Facebook',
    method: 'POST',
    url: finalUrl,
    headers: { Accept: 'application/json' },
    json,
  });
  return { outputs: { result: res.data }, logs: [`Facebook POST ${url}`] };
}

async function nodeDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { url, accessToken } = buildUrl(ctx);
  const finalUrl = appendQuery(url, { access_token: accessToken });
  const res = await apiRequest({
    service: 'Facebook',
    method: 'DELETE',
    url: finalUrl,
    headers: { Accept: 'application/json' },
  });
  return { outputs: { result: res.data }, logs: [`Facebook DELETE ${url}`] };
}

const HOST_OPTIONS = [
  { label: 'graph.facebook.com', value: 'graph.facebook.com' },
  { label: 'graph-video.facebook.com', value: 'graph-video.facebook.com' },
];

const VERSION_OPTIONS = [
  { label: 'Default', value: '' },
  { label: 'v23.0', value: 'v23.0' },
  { label: 'v22.0', value: 'v22.0' },
  { label: 'v21.0', value: 'v21.0' },
  { label: 'v20.0', value: 'v20.0' },
  { label: 'v19.0', value: 'v19.0' },
  { label: 'v18.0', value: 'v18.0' },
  { label: 'v17.0', value: 'v17.0' },
];

const block: ForgeBlock = {
  id: 'forge_facebook',
  name: 'Facebook Graph API',
  description: 'Generic GET/POST/DELETE against the Facebook Graph API.',
  iconName: 'LuFacebook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'node_get',
      label: 'Get node',
      description: 'Read a Graph API node/edge.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'hostUrl', label: 'Host', type: 'select', options: HOST_OPTIONS, defaultValue: 'graph.facebook.com' },
        { id: 'graphApiVersion', label: 'API version', type: 'select', options: VERSION_OPTIONS, defaultValue: '' },
        { id: 'node', label: 'Node', type: 'text', required: true, placeholder: 'me' },
        { id: 'edge', label: 'Edge', type: 'text', placeholder: 'feed' },
        { id: 'fields', label: 'Fields (comma separated)', type: 'text' },
        { id: 'queryParams', label: 'Extra query params (JSON)', type: 'textarea' },
      ],
      run: nodeGet,
    },
    {
      id: 'node_post',
      label: 'Post to node',
      description: 'Create/update an object on a Graph API node/edge.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'hostUrl', label: 'Host', type: 'select', options: HOST_OPTIONS, defaultValue: 'graph.facebook.com' },
        { id: 'graphApiVersion', label: 'API version', type: 'select', options: VERSION_OPTIONS, defaultValue: '' },
        { id: 'node', label: 'Node', type: 'text', required: true },
        { id: 'edge', label: 'Edge', type: 'text' },
        { id: 'body', label: 'JSON body', type: 'textarea' },
      ],
      run: nodePost,
    },
    {
      id: 'node_delete',
      label: 'Delete node',
      description: 'Remove an object from the Graph.',
      fields: [
        { id: 'accessToken', label: 'Access token', type: 'password', required: true },
        { id: 'hostUrl', label: 'Host', type: 'select', options: HOST_OPTIONS, defaultValue: 'graph.facebook.com' },
        { id: 'graphApiVersion', label: 'API version', type: 'select', options: VERSION_OPTIONS, defaultValue: '' },
        { id: 'node', label: 'Node', type: 'text', required: true },
        { id: 'edge', label: 'Edge', type: 'text' },
      ],
      run: nodeDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
