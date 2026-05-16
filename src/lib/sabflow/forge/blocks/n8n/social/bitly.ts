/**
 * Forge block: Bitly
 *
 * Source: n8n-master/packages/nodes-base/nodes/Bitly/Bitly.node.ts
 * Credential type: 'bitly' (CREDENTIAL_FIELD_SCHEMAS → { accessToken })
 *
 * Operations:
 *   - link.create   POST /v4/bitlinks
 *   - link.get      GET  /v4/bitlinks/{bitlink}
 *   - link.update   PATCH /v4/bitlinks/{bitlink}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api-ssl.bitly.com/v4';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Bitly', ctx.credential);
  const token = cred.accessToken;
  if (!token) throw new Error('Bitly: credential is missing `accessToken`');
  return { Authorization: `Bearer ${token}` };
}

async function linkCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const longUrl = asString(ctx.options.longUrl);
  if (!longUrl) throw new Error('Bitly: longUrl is required');
  const body: Record<string, unknown> = { long_url: longUrl };
  if (asString(ctx.options.title)) body.title = asString(ctx.options.title);
  if (asString(ctx.options.domain)) body.domain = asString(ctx.options.domain);
  if (asString(ctx.options.groupGuid)) body.group_guid = asString(ctx.options.groupGuid);
  const tagsRaw = asString(ctx.options.tags);
  if (tagsRaw) body.tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);

  const res = await apiRequest({
    service: 'Bitly',
    method: 'POST',
    url: `${BASE}/bitlinks`,
    headers: authHeaders(ctx),
    json: body,
  });
  const data = res.data as { id?: string; link?: string };
  return { outputs: { link: data }, logs: [`Bitly create → ${data.link ?? data.id ?? '?'}`] };
}

async function linkGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const bitlink = asString(ctx.options.bitlink);
  if (!bitlink) throw new Error('Bitly: bitlink is required (e.g. bit.ly/abc123)');
  const res = await apiRequest({
    service: 'Bitly',
    method: 'GET',
    url: `${BASE}/bitlinks/${encodeURIComponent(bitlink)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { link: res.data }, logs: [`Bitly get → ${bitlink}`] };
}

async function linkUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const bitlink = asString(ctx.options.bitlink);
  if (!bitlink) throw new Error('Bitly: bitlink is required');

  const body: Record<string, unknown> = {};
  if (asString(ctx.options.title)) body.title = asString(ctx.options.title);
  if (asString(ctx.options.longUrl)) body.long_url = asString(ctx.options.longUrl);
  if (ctx.options.archived !== undefined && ctx.options.archived !== '') {
    body.archived = ctx.options.archived === true || ctx.options.archived === 'true';
  }
  const tagsRaw = asString(ctx.options.tags);
  if (tagsRaw) body.tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
  if (Object.keys(body).length === 0) {
    throw new Error('Bitly: at least one updatable field must be set');
  }

  const res = await apiRequest({
    service: 'Bitly',
    method: 'PATCH',
    url: `${BASE}/bitlinks/${encodeURIComponent(bitlink)}`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { link: res.data }, logs: [`Bitly update → ${bitlink}`] };
}

const block: ForgeBlock = {
  id: 'forge_bitly',
  name: 'Bitly',
  description: 'Shorten and manage Bitly links.',
  iconName: 'LuLink',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'bitly' },
  actions: [
    {
      id: 'link_create',
      label: 'Create short link',
      description: 'Shorten a long URL into a Bitlink.',
      fields: [
        { id: 'longUrl', label: 'Long URL', type: 'text', required: true, placeholder: 'https://example.com/page' },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'domain', label: 'Domain', type: 'text', placeholder: 'bit.ly' },
        { id: 'groupGuid', label: 'Group GUID', type: 'text' },
        { id: 'tags', label: 'Tags (comma-separated)', type: 'text' },
      ],
      run: linkCreate,
    },
    {
      id: 'link_get',
      label: 'Get link',
      description: 'Fetch metadata for an existing Bitlink.',
      fields: [
        { id: 'bitlink', label: 'Bitlink', type: 'text', required: true, placeholder: 'bit.ly/abc123' },
      ],
      run: linkGet,
    },
    {
      id: 'link_update',
      label: 'Update link',
      description: 'Patch title / tags / long URL on an existing Bitlink.',
      fields: [
        { id: 'bitlink', label: 'Bitlink', type: 'text', required: true, placeholder: 'bit.ly/abc123' },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'longUrl', label: 'Long URL', type: 'text' },
        { id: 'tags', label: 'Tags (comma-separated)', type: 'text' },
        { id: 'archived', label: 'Archived', type: 'toggle' },
      ],
      run: linkUpdate,
    },
  ],
};

registerForgeBlock(block);
export default block;
