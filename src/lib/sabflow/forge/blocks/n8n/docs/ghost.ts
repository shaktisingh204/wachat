/**
 * Forge block: Ghost
 *
 * Source: n8n-master/packages/nodes-base/nodes/Ghost/Ghost.node.ts
 *   (+ PostDescription.ts, GenericFunctions.ts)
 * Credential type: 'ghost' — fields: { baseUrl, adminApiKey }
 *
 * Ghost Admin API auth: the credential's `adminApiKey` is `<id>:<secret>` where
 * `secret` is hex-encoded. We sign a short-lived HS256 JWT with kid=id and use
 * it as a `Ghost <token>` bearer against /ghost/api/admin endpoints.
 *
 * Operations covered:
 *   - post.create        POST   /ghost/api/admin/posts/
 *   - post.get           GET    /ghost/api/admin/posts/{id}/
 *   - post.get_by_slug   GET    /ghost/api/admin/posts/slug/{slug}/
 *   - post.list          GET    /ghost/api/admin/posts/
 *   - post.list_all      GET    /ghost/api/admin/posts/  (paginated)
 *   - post.update        PUT    /ghost/api/admin/posts/{id}/   (requires updated_at)
 *   - post.delete        DELETE /ghost/api/admin/posts/{id}/
 *   - page.create        POST   /ghost/api/admin/pages/
 *   - page.get           GET    /ghost/api/admin/pages/{id}/
 *   - page.list          GET    /ghost/api/admin/pages/
 *   - page.update        PUT    /ghost/api/admin/pages/{id}/   (requires updated_at)
 *   - page.delete        DELETE /ghost/api/admin/pages/{id}/
 *   - tag.list           GET    /ghost/api/admin/tags/
 *   - tag.create         POST   /ghost/api/admin/tags/
 *
 * Out of scope:
 *   - Member, image-upload resources (image upload needs binary multipart
 *     plumbing not yet wired through the forge runtime)
 *   - Content API (read-only public key flow) — only Admin API is wired
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signAdminJwt(adminApiKey: string): Promise<string> {
  const { createHmac } = await import('node:crypto');
  const [id, secret] = adminApiKey.split(':');
  if (!id || !secret) {
    throw new Error('Ghost: adminApiKey must be `<id>:<secret>`');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT', kid: id };
  const payload = { iat: now, exp: now + 5 * 60, aud: '/admin/' };
  const headerB64 = base64url(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = Buffer.from(secret, 'hex');
  const signature = base64url(createHmac('sha256', key).update(signingInput).digest());
  return `${signingInput}.${signature}`;
}

async function getBase(ctx: ForgeActionContext): Promise<{ url: string; token: string }> {
  const cred = requireCredential('Ghost', ctx.credential);
  const baseUrl = (cred.baseUrl || '').replace(/\/+$/, '');
  const adminApiKey = cred.adminApiKey ?? cred.apiKey;
  if (!baseUrl) throw new Error('Ghost: credential is missing `baseUrl`');
  if (!adminApiKey) throw new Error('Ghost: credential is missing `adminApiKey`');
  return { url: baseUrl, token: await signAdminJwt(adminApiKey) };
}

async function ghostApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { url, token } = await getBase(ctx);
  const res = await apiRequest({
    service: 'Ghost',
    method,
    url: `${url}/ghost/api/admin${path}`,
    headers: { Authorization: `Ghost ${token}` },
    json,
  });
  return res.data;
}

function parsePostFields(raw: unknown, kind: 'post' | 'page' | 'tag'): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  const s = asString(raw).trim();
  if (s) {
    try {
      const v = JSON.parse(s);
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        Object.assign(obj, v as Record<string, unknown>);
      } else {
        throw new Error(`Ghost: ${kind} extra fields must be a JSON object`);
      }
    } catch {
      throw new Error(`Ghost: ${kind} extra fields must be valid JSON`);
    }
  }
  return obj;
}

// ── Post ───────────────────────────────────────────────────────────────────

async function postCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  if (!title) throw new Error('Ghost: title is required');
  const post: Record<string, unknown> = { title, ...parsePostFields(ctx.options.extra, 'post') };
  const html = asString(ctx.options.html);
  if (html) post.html = html;
  const status = asString(ctx.options.status);
  if (status) post.status = status;

  const data = await ghostApi(ctx, 'POST', '/posts/?source=html', { posts: [post] });
  return { outputs: { result: data }, logs: [`Ghost post create → ${title}`] };
}

async function postGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.postId);
  if (!id) throw new Error('Ghost: postId is required');
  const data = await ghostApi(ctx, 'GET', `/posts/${encodeURIComponent(id)}/`);
  return { outputs: { post: data }, logs: [`Ghost post get → ${id}`] };
}

async function postGetBySlug(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const slug = asString(ctx.options.slug);
  if (!slug) throw new Error('Ghost: slug is required');
  const data = await ghostApi(ctx, 'GET', `/posts/slug/${encodeURIComponent(slug)}/`);
  return { outputs: { post: data }, logs: [`Ghost post get by slug → ${slug}`] };
}

async function postList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await ghostApi(ctx, 'GET', '/posts/');
  return { outputs: { result: data }, logs: ['Ghost post list'] };
}

async function postListAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const { url, token } = await getBase(ctx);

  const posts = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const u = new URL(`${url}/ghost/api/admin/posts/`);
      u.searchParams.set('limit', '50');
      u.searchParams.set('page', cursor ?? '1');
      const res = await apiRequest({
        service: 'Ghost',
        method: 'GET',
        url: u.toString(),
        headers: { Authorization: `Ghost ${token}` },
      });
      const body = res.data as {
        posts?: unknown[];
        meta?: { pagination?: { next?: number | null } };
      } | null;
      const items = (body?.posts ?? []) as unknown[];
      const next = body?.meta?.pagination?.next;
      const nextCursor = next != null ? String(next) : undefined;
      return { items, nextCursor };
    },
  });

  return { outputs: { posts, count: posts.length }, logs: [`Ghost post list all → ${posts.length}`] };
}

async function postUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.postId);
  if (!id) throw new Error('Ghost: postId is required');
  // Ghost requires `updated_at` on PUT — fetch the current value first.
  const current = (await ghostApi(ctx, 'GET', `/posts/${encodeURIComponent(id)}/?fields=id,updated_at`)) as {
    posts?: Array<{ id?: string; updated_at?: string }>;
  } | null;
  const updated_at = current?.posts?.[0]?.updated_at;
  if (!updated_at) throw new Error('Ghost: could not read current updated_at — post not found?');

  const post: Record<string, unknown> = { updated_at, ...parsePostFields(ctx.options.extra, 'post') };
  if (asString(ctx.options.title)) post.title = asString(ctx.options.title);
  const html = asString(ctx.options.html);
  if (html) post.html = html;
  if (asString(ctx.options.status)) post.status = asString(ctx.options.status);
  const suffix = html ? '?source=html' : '';
  const data = await ghostApi(ctx, 'PUT', `/posts/${encodeURIComponent(id)}/${suffix}`, { posts: [post] });
  return { outputs: { result: data }, logs: [`Ghost post update → ${id}`] };
}

async function postDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.postId);
  if (!id) throw new Error('Ghost: postId is required');
  const data = await ghostApi(ctx, 'DELETE', `/posts/${encodeURIComponent(id)}/`);
  return { outputs: { result: data, id }, logs: [`Ghost post delete → ${id}`] };
}

// ── Page ───────────────────────────────────────────────────────────────────

async function pageCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  if (!title) throw new Error('Ghost: title is required');
  const page: Record<string, unknown> = { title, ...parsePostFields(ctx.options.extra, 'page') };
  const html = asString(ctx.options.html);
  if (html) page.html = html;
  const status = asString(ctx.options.status);
  if (status) page.status = status;

  const data = await ghostApi(ctx, 'POST', '/pages/?source=html', { pages: [page] });
  return { outputs: { result: data }, logs: [`Ghost page create → ${title}`] };
}

async function pageGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.pageId);
  if (!id) throw new Error('Ghost: pageId is required');
  const data = await ghostApi(ctx, 'GET', `/pages/${encodeURIComponent(id)}/`);
  return { outputs: { page: data }, logs: [`Ghost page get → ${id}`] };
}

async function pageList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await ghostApi(ctx, 'GET', '/pages/');
  return { outputs: { result: data }, logs: ['Ghost page list'] };
}

async function pageUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.pageId);
  if (!id) throw new Error('Ghost: pageId is required');
  const current = (await ghostApi(ctx, 'GET', `/pages/${encodeURIComponent(id)}/?fields=id,updated_at`)) as {
    pages?: Array<{ id?: string; updated_at?: string }>;
  } | null;
  const updated_at = current?.pages?.[0]?.updated_at;
  if (!updated_at) throw new Error('Ghost: could not read current updated_at — page not found?');

  const page: Record<string, unknown> = { updated_at, ...parsePostFields(ctx.options.extra, 'page') };
  if (asString(ctx.options.title)) page.title = asString(ctx.options.title);
  const html = asString(ctx.options.html);
  if (html) page.html = html;
  if (asString(ctx.options.status)) page.status = asString(ctx.options.status);
  const suffix = html ? '?source=html' : '';
  const data = await ghostApi(ctx, 'PUT', `/pages/${encodeURIComponent(id)}/${suffix}`, { pages: [page] });
  return { outputs: { result: data }, logs: [`Ghost page update → ${id}`] };
}

async function pageDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.pageId);
  if (!id) throw new Error('Ghost: pageId is required');
  const data = await ghostApi(ctx, 'DELETE', `/pages/${encodeURIComponent(id)}/`);
  return { outputs: { result: data, id }, logs: [`Ghost page delete → ${id}`] };
}

// ── Tag ────────────────────────────────────────────────────────────────────

async function tagList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await ghostApi(ctx, 'GET', '/tags/');
  return { outputs: { result: data }, logs: ['Ghost tag list'] };
}

async function tagCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Ghost: tag name is required');
  const tag: Record<string, unknown> = { name, ...parsePostFields(ctx.options.extra, 'tag') };
  if (asString(ctx.options.slug)) tag.slug = asString(ctx.options.slug);
  if (asString(ctx.options.description)) tag.description = asString(ctx.options.description);
  const data = await ghostApi(ctx, 'POST', '/tags/', { tags: [tag] });
  return { outputs: { result: data }, logs: [`Ghost tag create → ${name}`] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const statusOptions = [
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Scheduled', value: 'scheduled' },
];

const block: ForgeBlock = {
  id: 'forge_ghost',
  name: 'Ghost',
  description: 'Manage posts, pages and tags on a Ghost site via the Admin API.',
  iconName: 'LuFeather',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'ghost' },
  actions: [
    // Post
    { id: 'post_create', label: 'Create post', description: 'Create a new post.',
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'html', label: 'HTML', type: 'textarea' },
        { id: 'status', label: 'Status', type: 'select', options: statusOptions, defaultValue: 'draft' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: postCreate },
    { id: 'post_get', label: 'Get post', description: 'Fetch a post by id.',
      fields: [{ id: 'postId', label: 'Post ID', type: 'text', required: true }], run: postGet },
    { id: 'post_get_by_slug', label: 'Get post by slug', description: 'Fetch a post by slug.',
      fields: [{ id: 'slug', label: 'Slug', type: 'text', required: true }], run: postGetBySlug },
    { id: 'post_list', label: 'List posts', description: 'List posts from the admin API.',
      fields: [], run: postList },
    { id: 'post_list_all', label: 'List all posts (paginated)',
      description: 'Walk Ghost\'s meta.pagination.next cursor and return every post up to the cap.',
      fields: [{ id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' }],
      run: postListAll },
    { id: 'post_update', label: 'Update post',
      description: 'Patch a post — Ghost requires the current updated_at, which we fetch automatically.',
      fields: [
        { id: 'postId', label: 'Post ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'html', label: 'HTML', type: 'textarea' },
        { id: 'status', label: 'Status', type: 'select', options: statusOptions },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: postUpdate },
    { id: 'post_delete', label: 'Delete post', description: 'Permanently delete a post.',
      fields: [{ id: 'postId', label: 'Post ID', type: 'text', required: true }], run: postDelete },

    // Page
    { id: 'page_create', label: 'Create page', description: 'Create a new page.',
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'html', label: 'HTML', type: 'textarea' },
        { id: 'status', label: 'Status', type: 'select', options: statusOptions, defaultValue: 'draft' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: pageCreate },
    { id: 'page_get', label: 'Get page', description: 'Fetch a page by id.',
      fields: [{ id: 'pageId', label: 'Page ID', type: 'text', required: true }], run: pageGet },
    { id: 'page_list', label: 'List pages', description: 'List pages from the admin API.',
      fields: [], run: pageList },
    { id: 'page_update', label: 'Update page',
      description: 'Patch a page — Ghost requires the current updated_at, which we fetch automatically.',
      fields: [
        { id: 'pageId', label: 'Page ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'html', label: 'HTML', type: 'textarea' },
        { id: 'status', label: 'Status', type: 'select', options: statusOptions },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: pageUpdate },
    { id: 'page_delete', label: 'Delete page', description: 'Permanently delete a page.',
      fields: [{ id: 'pageId', label: 'Page ID', type: 'text', required: true }], run: pageDelete },

    // Tag
    { id: 'tag_list', label: 'List tags', description: 'List tags from the admin API.',
      fields: [], run: tagList },
    { id: 'tag_create', label: 'Create tag', description: 'Create a new tag.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'slug', label: 'Slug', type: 'text' },
        { id: 'description', label: 'Description', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ], run: tagCreate },
  ],
};

registerForgeBlock(block);
export default block;
