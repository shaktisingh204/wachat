/**
 * Forge block: WordPress
 *
 * Source: n8n-master/packages/nodes-base/nodes/Wordpress/Wordpress.node.ts
 * Credential type: 'wordpress' — fields: { baseUrl, username, appPassword }
 *
 * Authentication: WordPress REST API Basic auth with an application password.
 * We base64-encode `username:appPassword` without depending on Node's Buffer
 * being globally available — use `btoa()` first and fall back to
 * `globalThis.Buffer` for legacy runtimes.
 *
 * Operations covered:
 *   - post.create   POST   /wp/v2/posts
 *   - post.get      GET    /wp/v2/posts/{id}
 *   - post.list     GET    /wp/v2/posts
 *   - post.update   PUT    /wp/v2/posts/{id}
 *   - post.delete   DELETE /wp/v2/posts/{id}
 *   - user.get      GET    /wp/v2/users/{id}
 *
 * Out of scope:
 *   - Media upload, category / tag CRUD
 *   - LoadOptions for categories / authors
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

function toBase64(input: string): string {
  if (typeof btoa === 'function') return btoa(input);
  const B = (globalThis as { Buffer?: { from: (s: string, enc?: string) => { toString: (enc: string) => string } } }).Buffer;
  if (B) return B.from(input, 'utf-8').toString('base64');
  throw new Error('WordPress: no base64 encoder available in this runtime');
}

function getAuth(ctx: ForgeActionContext): { url: string; basic: string } {
  const cred = requireCredential('WordPress', ctx.credential);
  const baseUrl = (cred.baseUrl || '').replace(/\/+$/, '');
  const username = cred.username;
  const appPassword = cred.appPassword ?? cred.password;
  if (!baseUrl) throw new Error('WordPress: credential is missing `baseUrl`');
  if (!username) throw new Error('WordPress: credential is missing `username`');
  if (!appPassword) throw new Error('WordPress: credential is missing `appPassword`');
  const basic = toBase64(`${username}:${appPassword}`);
  return { url: baseUrl, basic };
}

async function wpApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { url, basic } = getAuth(ctx);
  const res = await apiRequest({
    service: 'WordPress',
    method,
    url: `${url}/wp-json${path}`,
    headers: { Authorization: `Basic ${basic}` },
    json,
  });
  return res.data;
}

function parseJsonObject(label: string, raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error(`WordPress: ${label} must be a JSON object`);
}

// ── Post ───────────────────────────────────────────────────────────────────

async function postCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  if (!title) throw new Error('WordPress: title is required');
  const body: Record<string, unknown> = { title, ...parseJsonObject('extra', ctx.options.extra) };
  if (asString(ctx.options.content)) body.content = asString(ctx.options.content);
  if (asString(ctx.options.status)) body.status = asString(ctx.options.status);
  if (asString(ctx.options.excerpt)) body.excerpt = asString(ctx.options.excerpt);
  const data = await wpApi(ctx, 'POST', '/wp/v2/posts', body);
  return { outputs: { post: data }, logs: [`WP post create → ${title}`] };
}

async function postGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.postId);
  if (!id) throw new Error('WordPress: postId is required');
  const data = await wpApi(ctx, 'GET', `/wp/v2/posts/${encodeURIComponent(id)}`);
  return { outputs: { post: data }, logs: [`WP post get → ${id}`] };
}

async function postList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await wpApi(ctx, 'GET', '/wp/v2/posts');
  return { outputs: { result: data }, logs: ['WP post list'] };
}

async function postListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { url, basic } = getAuth(ctx);
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asString(ctx.options.pageSize) || '100';
  const status = asString(ctx.options.status);
  const search = asString(ctx.options.search);

  const posts = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const page = cursor ?? '1';
      const qs = new URLSearchParams();
      qs.set('per_page', pageSize);
      qs.set('page', page);
      if (status) qs.set('status', status);
      if (search) qs.set('search', search);
      const res = await apiRequest({
        service: 'WordPress',
        method: 'GET',
        url: `${url}/wp-json/wp/v2/posts?${qs.toString()}`,
        headers: { Authorization: `Basic ${basic}` },
      });
      const items = ((res.data as unknown[] | null) ?? []) as unknown[];
      const totalPagesHeader = res.headers.get('x-wp-totalpages');
      const totalPages = totalPagesHeader ? Number(totalPagesHeader) : NaN;
      const current = Number(page);
      const more = Number.isFinite(totalPages) ? current < totalPages : items.length === Number(pageSize);
      const nextCursor = more ? String(current + 1) : undefined;
      return { items, nextCursor };
    },
  });

  return {
    outputs: { posts, count: posts.length },
    logs: [`WP post list all → ${posts.length}`],
  };
}

async function postUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.postId);
  if (!id) throw new Error('WordPress: postId is required');
  const body: Record<string, unknown> = { ...parseJsonObject('extra', ctx.options.extra) };
  if (asString(ctx.options.title)) body.title = asString(ctx.options.title);
  if (asString(ctx.options.content)) body.content = asString(ctx.options.content);
  if (asString(ctx.options.status)) body.status = asString(ctx.options.status);
  if (asString(ctx.options.excerpt)) body.excerpt = asString(ctx.options.excerpt);
  if (Object.keys(body).length === 0) throw new Error('WordPress: at least one updatable field must be set');
  const data = await wpApi(ctx, 'PUT', `/wp/v2/posts/${encodeURIComponent(id)}`, body);
  return { outputs: { post: data }, logs: [`WP post update → ${id}`] };
}

async function postDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.postId);
  if (!id) throw new Error('WordPress: postId is required');
  const data = await wpApi(ctx, 'DELETE', `/wp/v2/posts/${encodeURIComponent(id)}?force=true`);
  return { outputs: { result: data }, logs: [`WP post delete → ${id}`] };
}

// ── User ───────────────────────────────────────────────────────────────────

async function userGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.userId);
  if (!id) throw new Error('WordPress: userId is required');
  const data = await wpApi(ctx, 'GET', `/wp/v2/users/${encodeURIComponent(id)}`);
  return { outputs: { user: data }, logs: [`WP user get → ${id}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const statusOptions = [
  { label: 'Draft', value: 'draft' },
  { label: 'Publish', value: 'publish' },
  { label: 'Future', value: 'future' },
  { label: 'Pending', value: 'pending' },
  { label: 'Private', value: 'private' },
];

const block: ForgeBlock = {
  id: 'forge_wordpress',
  name: 'WordPress',
  description: 'Manage WordPress posts and users via the REST API.',
  iconName: 'LuPenSquare',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'wordpress' },
  actions: [
    {
      id: 'post_create',
      label: 'Create post',
      description: 'Create a new post.',
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'content', label: 'Content (HTML)', type: 'textarea' },
        { id: 'excerpt', label: 'Excerpt', type: 'textarea' },
        { id: 'status', label: 'Status', type: 'select', options: statusOptions, defaultValue: 'draft' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: postCreate,
    },
    {
      id: 'post_get',
      label: 'Get post',
      description: 'Fetch a post by id.',
      fields: [
        { id: 'postId', label: 'Post ID', type: 'text', required: true },
      ],
      run: postGet,
    },
    {
      id: 'post_list',
      label: 'List posts',
      description: 'List posts (defaults to first page).',
      fields: [],
      run: postList,
    },
    {
      id: 'post_list_all',
      label: 'List all posts (paginated)',
      description: 'Walk WP\'s page-based pagination (X-WP-TotalPages) and return every post up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 100)', type: 'number', defaultValue: '100' },
        { id: 'status', label: 'Status (optional)', type: 'select', options: [{ label: 'Any', value: '' }, ...statusOptions] },
        { id: 'search', label: 'Search (optional)', type: 'text' },
      ],
      run: postListAll,
    },
    {
      id: 'post_update',
      label: 'Update post',
      description: 'Patch an existing post.',
      fields: [
        { id: 'postId', label: 'Post ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'content', label: 'Content (HTML)', type: 'textarea' },
        { id: 'excerpt', label: 'Excerpt', type: 'textarea' },
        { id: 'status', label: 'Status', type: 'select', options: [{ label: 'Unchanged', value: '' }, ...statusOptions] },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: postUpdate,
    },
    {
      id: 'post_delete',
      label: 'Delete post',
      description: 'Permanently delete a post (force=true).',
      fields: [
        { id: 'postId', label: 'Post ID', type: 'text', required: true },
      ],
      run: postDelete,
    },
    {
      id: 'user_get',
      label: 'Get user',
      description: 'Fetch a user by id.',
      fields: [
        { id: 'userId', label: 'User ID', type: 'text', required: true },
      ],
      run: userGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
