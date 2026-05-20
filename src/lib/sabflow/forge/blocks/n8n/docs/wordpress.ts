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
 *   - page.create   POST   /wp/v2/pages
 *   - page.get      GET    /wp/v2/pages/{id}
 *   - page.list     GET    /wp/v2/pages
 *   - page.update   PUT    /wp/v2/pages/{id}
 *   - page.delete   DELETE /wp/v2/pages/{id}
 *   - user.create   POST   /wp/v2/users
 *   - user.get      GET    /wp/v2/users/{id}
 *   - user.list     GET    /wp/v2/users
 *   - user.update   PUT    /wp/v2/users/{id}
 *   - user.delete   DELETE /wp/v2/users/{id}?reassign=&force=true
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

// ── Page ───────────────────────────────────────────────────────────────────

async function pageCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  if (!title) throw new Error('WordPress: title is required');
  const body: Record<string, unknown> = { title, ...parseJsonObject('extra', ctx.options.extra) };
  if (asString(ctx.options.content)) body.content = asString(ctx.options.content);
  if (asString(ctx.options.status)) body.status = asString(ctx.options.status);
  if (asString(ctx.options.slug)) body.slug = asString(ctx.options.slug);
  const parent = asNumber(ctx.options.parent);
  if (parent !== undefined) body.parent = parent;
  const data = await wpApi(ctx, 'POST', '/wp/v2/pages', body);
  return { outputs: { page: data }, logs: [`WP page create → ${title}`] };
}

async function pageGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.pageId);
  if (!id) throw new Error('WordPress: pageId is required');
  const data = await wpApi(ctx, 'GET', `/wp/v2/pages/${encodeURIComponent(id)}`);
  return { outputs: { page: data }, logs: [`WP page get → ${id}`] };
}

async function pageList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { url, basic } = getAuth(ctx);
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asString(ctx.options.pageSize) || '100';
  const status = asString(ctx.options.status);
  const search = asString(ctx.options.search);

  const pages = await paginateAll<unknown>({
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
        url: `${url}/wp-json/wp/v2/pages?${qs.toString()}`,
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

  return { outputs: { pages, count: pages.length }, logs: [`WP page list → ${pages.length}`] };
}

async function pageUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.pageId);
  if (!id) throw new Error('WordPress: pageId is required');
  const body: Record<string, unknown> = { ...parseJsonObject('extra', ctx.options.extra) };
  if (asString(ctx.options.title)) body.title = asString(ctx.options.title);
  if (asString(ctx.options.content)) body.content = asString(ctx.options.content);
  if (asString(ctx.options.status)) body.status = asString(ctx.options.status);
  if (asString(ctx.options.slug)) body.slug = asString(ctx.options.slug);
  const parent = asNumber(ctx.options.parent);
  if (parent !== undefined) body.parent = parent;
  if (Object.keys(body).length === 0) throw new Error('WordPress: at least one updatable field must be set');
  const data = await wpApi(ctx, 'PUT', `/wp/v2/pages/${encodeURIComponent(id)}`, body);
  return { outputs: { page: data }, logs: [`WP page update → ${id}`] };
}

async function pageDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.pageId);
  if (!id) throw new Error('WordPress: pageId is required');
  const data = await wpApi(ctx, 'DELETE', `/wp/v2/pages/${encodeURIComponent(id)}?force=true`);
  return { outputs: { result: data }, logs: [`WP page delete → ${id}`] };
}

// ── User ───────────────────────────────────────────────────────────────────

async function userCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const username = asString(ctx.options.username);
  const email = asString(ctx.options.email);
  const password = asString(ctx.options.password);
  if (!username) throw new Error('WordPress: username is required');
  if (!email) throw new Error('WordPress: email is required');
  if (!password) throw new Error('WordPress: password is required');
  const body: Record<string, unknown> = { username, email, password, ...parseJsonObject('extra', ctx.options.extra) };
  if (asString(ctx.options.name)) body.name = asString(ctx.options.name);
  if (asString(ctx.options.firstName)) body.first_name = asString(ctx.options.firstName);
  if (asString(ctx.options.lastName)) body.last_name = asString(ctx.options.lastName);
  const data = await wpApi(ctx, 'POST', '/wp/v2/users', body);
  return { outputs: { user: data }, logs: [`WP user create → ${username}`] };
}

async function userGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.userId);
  if (!id) throw new Error('WordPress: userId is required');
  const data = await wpApi(ctx, 'GET', `/wp/v2/users/${encodeURIComponent(id)}`);
  return { outputs: { user: data }, logs: [`WP user get → ${id}`] };
}

async function userList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { url, basic } = getAuth(ctx);
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asString(ctx.options.pageSize) || '100';
  const search = asString(ctx.options.search);

  const users = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const page = cursor ?? '1';
      const qs = new URLSearchParams();
      qs.set('per_page', pageSize);
      qs.set('page', page);
      if (search) qs.set('search', search);
      const res = await apiRequest({
        service: 'WordPress',
        method: 'GET',
        url: `${url}/wp-json/wp/v2/users?${qs.toString()}`,
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

  return { outputs: { users, count: users.length }, logs: [`WP user list → ${users.length}`] };
}

async function userUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.userId);
  if (!id) throw new Error('WordPress: userId is required');
  const body: Record<string, unknown> = { ...parseJsonObject('extra', ctx.options.extra) };
  if (asString(ctx.options.name)) body.name = asString(ctx.options.name);
  if (asString(ctx.options.firstName)) body.first_name = asString(ctx.options.firstName);
  if (asString(ctx.options.lastName)) body.last_name = asString(ctx.options.lastName);
  if (asString(ctx.options.email)) body.email = asString(ctx.options.email);
  if (asString(ctx.options.password)) body.password = asString(ctx.options.password);
  if (Object.keys(body).length === 0) throw new Error('WordPress: at least one updatable field must be set');
  const data = await wpApi(ctx, 'PUT', `/wp/v2/users/${encodeURIComponent(id)}`, body);
  return { outputs: { user: data }, logs: [`WP user update → ${id}`] };
}

async function userDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.userId);
  if (!id) throw new Error('WordPress: userId is required');
  // WP requires `force=true` for users plus a `reassign` target (defaults to the auth user id when omitted).
  const reassign = asString(ctx.options.reassign);
  const qs = new URLSearchParams({ force: 'true' });
  if (reassign) qs.set('reassign', reassign);
  const data = await wpApi(ctx, 'DELETE', `/wp/v2/users/${encodeURIComponent(id)}?${qs.toString()}`);
  return { outputs: { result: data }, logs: [`WP user delete → ${id}`] };
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
      id: 'page_create',
      label: 'Create page',
      description: 'Create a new page.',
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'content', label: 'Content (HTML)', type: 'textarea' },
        { id: 'status', label: 'Status', type: 'select', options: statusOptions, defaultValue: 'draft' },
        { id: 'slug', label: 'Slug', type: 'text' },
        { id: 'parent', label: 'Parent page ID', type: 'number' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: pageCreate,
    },
    {
      id: 'page_get',
      label: 'Get page',
      description: 'Fetch a page by id.',
      fields: [{ id: 'pageId', label: 'Page ID', type: 'text', required: true }],
      run: pageGet,
    },
    {
      id: 'page_list',
      label: 'List all pages (paginated)',
      description: 'Walk WP\'s page-based pagination and return every page up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 100)', type: 'number', defaultValue: '100' },
        { id: 'status', label: 'Status (optional)', type: 'select', options: [{ label: 'Any', value: '' }, ...statusOptions] },
        { id: 'search', label: 'Search (optional)', type: 'text' },
      ],
      run: pageList,
    },
    {
      id: 'page_update',
      label: 'Update page',
      description: 'Patch an existing page.',
      fields: [
        { id: 'pageId', label: 'Page ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'content', label: 'Content (HTML)', type: 'textarea' },
        { id: 'status', label: 'Status', type: 'select', options: [{ label: 'Unchanged', value: '' }, ...statusOptions] },
        { id: 'slug', label: 'Slug', type: 'text' },
        { id: 'parent', label: 'Parent page ID', type: 'number' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: pageUpdate,
    },
    {
      id: 'page_delete',
      label: 'Delete page',
      description: 'Permanently delete a page (force=true).',
      fields: [{ id: 'pageId', label: 'Page ID', type: 'text', required: true }],
      run: pageDelete,
    },
    {
      id: 'user_create',
      label: 'Create user',
      description: 'Create a new user. Requires admin app password.',
      fields: [
        { id: 'username', label: 'Username', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'password', label: 'Password', type: 'password', required: true },
        { id: 'name', label: 'Display name', type: 'text' },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: userCreate,
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
    {
      id: 'user_list',
      label: 'List all users (paginated)',
      description: 'Walk WP\'s page-based pagination and return every user up to the cap.',
      fields: [
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 100)', type: 'number', defaultValue: '100' },
        { id: 'search', label: 'Search (optional)', type: 'text' },
      ],
      run: userList,
    },
    {
      id: 'user_update',
      label: 'Update user',
      description: 'Patch an existing user.',
      fields: [
        { id: 'userId', label: 'User ID', type: 'text', required: true },
        { id: 'name', label: 'Display name', type: 'text' },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'password', label: 'Password', type: 'password' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: userUpdate,
    },
    {
      id: 'user_delete',
      label: 'Delete user',
      description: 'Permanently delete a user (force=true). Optionally reassign their content.',
      fields: [
        { id: 'userId', label: 'User ID', type: 'text', required: true },
        { id: 'reassign', label: 'Reassign content to user ID', type: 'text' },
      ],
      run: userDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
