/**
 * Forge block: Storyblok (Management API)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Storyblok/Storyblok.node.ts
 * Credential type: 'storyblok' (CREDENTIAL_FIELD_SCHEMAS → { oauthToken })
 *
 * Operations:
 *   - story.create     POST   /v1/spaces/{spaceId}/stories
 *   - story.get        GET    /v1/spaces/{spaceId}/stories/{storyId}
 *   - story.list       GET    /v1/spaces/{spaceId}/stories
 *   - story.update     PUT    /v1/spaces/{spaceId}/stories/{storyId}
 *   - story.delete     DELETE /v1/spaces/{spaceId}/stories/{storyId}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://mapi.storyblok.com/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Storyblok', ctx.credential);
  const token = cred.oauthToken;
  if (!token) throw new Error('Storyblok: credential is missing `oauthToken`');
  return { Authorization: token };
}

function requireSpace(ctx: ForgeActionContext): string {
  const spaceId = asString(ctx.options.spaceId);
  if (!spaceId) throw new Error('Storyblok: spaceId is required');
  return spaceId;
}

function parseJSON(label: string, raw: unknown): Record<string, unknown> | undefined {
  const s = asString(raw);
  if (!s) return undefined;
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    throw new Error(`Storyblok: ${label} must be valid JSON`);
  }
}

async function storyCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const spaceId = requireSpace(ctx);
  const name = asString(ctx.options.name);
  const slug = asString(ctx.options.slug);
  if (!name) throw new Error('Storyblok: name is required');
  if (!slug) throw new Error('Storyblok: slug is required');

  const story: Record<string, unknown> = { name, slug };
  const contentJson = parseJSON('content', ctx.options.content);
  if (contentJson) story.content = contentJson;
  if (asString(ctx.options.parentId)) story.parent_id = asString(ctx.options.parentId);

  const res = await apiRequest({
    service: 'Storyblok',
    method: 'POST',
    url: `${BASE}/spaces/${encodeURIComponent(spaceId)}/stories`,
    headers: authHeaders(ctx),
    json: { story },
  });
  return { outputs: { story: res.data }, logs: [`Storyblok story create → ${slug}`] };
}

async function storyGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const spaceId = requireSpace(ctx);
  const storyId = asString(ctx.options.storyId);
  if (!storyId) throw new Error('Storyblok: storyId is required');

  const res = await apiRequest({
    service: 'Storyblok',
    method: 'GET',
    url: `${BASE}/spaces/${encodeURIComponent(spaceId)}/stories/${encodeURIComponent(storyId)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { story: res.data }, logs: [`Storyblok story get → ${storyId}`] };
}

async function storyList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const spaceId = requireSpace(ctx);
  const params = new URLSearchParams();
  const perPage = asString(ctx.options.perPage);
  const page = asString(ctx.options.page);
  if (perPage) params.set('per_page', perPage);
  if (page) params.set('page', page);
  if (asString(ctx.options.search)) params.set('search', asString(ctx.options.search));

  const qs = params.toString();
  const res = await apiRequest({
    service: 'Storyblok',
    method: 'GET',
    url: `${BASE}/spaces/${encodeURIComponent(spaceId)}/stories${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { stories: res.data }, logs: ['Storyblok story list'] };
}

async function storyUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const spaceId = requireSpace(ctx);
  const storyId = asString(ctx.options.storyId);
  if (!storyId) throw new Error('Storyblok: storyId is required');

  const story: Record<string, unknown> = {};
  if (asString(ctx.options.name)) story.name = asString(ctx.options.name);
  if (asString(ctx.options.slug)) story.slug = asString(ctx.options.slug);
  const contentJson = parseJSON('content', ctx.options.content);
  if (contentJson) story.content = contentJson;
  if (Object.keys(story).length === 0) {
    throw new Error('Storyblok: at least one updatable field must be set');
  }

  const res = await apiRequest({
    service: 'Storyblok',
    method: 'PUT',
    url: `${BASE}/spaces/${encodeURIComponent(spaceId)}/stories/${encodeURIComponent(storyId)}`,
    headers: authHeaders(ctx),
    json: { story },
  });
  return { outputs: { story: res.data }, logs: [`Storyblok story update → ${storyId}`] };
}

async function storyDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const spaceId = requireSpace(ctx);
  const storyId = asString(ctx.options.storyId);
  if (!storyId) throw new Error('Storyblok: storyId is required');

  const res = await apiRequest({
    service: 'Storyblok',
    method: 'DELETE',
    url: `${BASE}/spaces/${encodeURIComponent(spaceId)}/stories/${encodeURIComponent(storyId)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { result: res.data }, logs: [`Storyblok story delete → ${storyId}`] };
}

const block: ForgeBlock = {
  id: 'forge_storyblok',
  name: 'Storyblok',
  description: 'Manage Storyblok stories via the Management API.',
  iconName: 'LuBookOpen',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'storyblok' },
  actions: [
    {
      id: 'story_create',
      label: 'Create story',
      description: 'Create a new story in a space.',
      fields: [
        { id: 'spaceId', label: 'Space ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'slug', label: 'Slug', type: 'text', required: true },
        { id: 'content', label: 'Content (JSON)', type: 'json', placeholder: '{"component":"page"}' },
        { id: 'parentId', label: 'Parent ID', type: 'text' },
      ],
      run: storyCreate,
    },
    {
      id: 'story_get',
      label: 'Get story',
      description: 'Fetch a single story.',
      fields: [
        { id: 'spaceId', label: 'Space ID', type: 'text', required: true },
        { id: 'storyId', label: 'Story ID', type: 'text', required: true },
      ],
      run: storyGet,
    },
    {
      id: 'story_list',
      label: 'List stories',
      description: 'List stories in a space.',
      fields: [
        { id: 'spaceId', label: 'Space ID', type: 'text', required: true },
        { id: 'search', label: 'Search term', type: 'text' },
        { id: 'page', label: 'Page', type: 'number' },
        { id: 'perPage', label: 'Per page', type: 'number', defaultValue: '25' },
      ],
      run: storyList,
    },
    {
      id: 'story_update',
      label: 'Update story',
      description: 'Patch an existing story.',
      fields: [
        { id: 'spaceId', label: 'Space ID', type: 'text', required: true },
        { id: 'storyId', label: 'Story ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'slug', label: 'Slug', type: 'text' },
        { id: 'content', label: 'Content (JSON)', type: 'json' },
      ],
      run: storyUpdate,
    },
    {
      id: 'story_delete',
      label: 'Delete story',
      description: 'Permanently delete a story.',
      fields: [
        { id: 'spaceId', label: 'Space ID', type: 'text', required: true },
        { id: 'storyId', label: 'Story ID', type: 'text', required: true },
      ],
      run: storyDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
