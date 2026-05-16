/**
 * Forge block: Ghost
 *
 * Source: n8n-master/packages/nodes-base/nodes/Ghost/Ghost.node.ts
 * Credential type: 'ghost' — fields: { baseUrl, adminApiKey }
 *
 * Ghost Admin API auth: the credential's `adminApiKey` is `<id>:<secret>` where
 * `secret` is hex-encoded. We sign a short-lived HS256 JWT with kid=id and use
 * it as a `Ghost <token>` bearer against /ghost/api/admin endpoints.
 *
 * Operations covered:
 *   - post.create   POST   /ghost/api/admin/posts/
 *   - post.get      GET    /ghost/api/admin/posts/{id}/
 *   - post.list     GET    /ghost/api/admin/posts/
 *   - page.create   POST   /ghost/api/admin/pages/
 *   - page.get      GET    /ghost/api/admin/pages/{id}/
 *
 * Out of scope:
 *   - Tag, member, image-upload resources
 *   - Content API (read-only public key flow) — only Admin API is wired
 */

import { createHmac } from 'node:crypto';

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function signAdminJwt(adminApiKey: string): string {
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

function getBase(ctx: ForgeActionContext): { url: string; token: string } {
  const cred = requireCredential('Ghost', ctx.credential);
  const baseUrl = (cred.baseUrl || '').replace(/\/+$/, '');
  const adminApiKey = cred.adminApiKey ?? cred.apiKey;
  if (!baseUrl) throw new Error('Ghost: credential is missing `baseUrl`');
  if (!adminApiKey) throw new Error('Ghost: credential is missing `adminApiKey`');
  return { url: baseUrl, token: signAdminJwt(adminApiKey) };
}

async function ghostApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { url, token } = getBase(ctx);
  const res = await apiRequest({
    service: 'Ghost',
    method,
    url: `${url}/ghost/api/admin${path}`,
    headers: { Authorization: `Ghost ${token}` },
    json,
  });
  return res.data;
}

function parsePostFields(raw: unknown, kind: 'post' | 'page'): Record<string, unknown> {
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

async function postList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await ghostApi(ctx, 'GET', '/posts/');
  return { outputs: { result: data }, logs: ['Ghost post list'] };
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

// ── Block ──────────────────────────────────────────────────────────────────

const statusOptions = [
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Scheduled', value: 'scheduled' },
];

const block: ForgeBlock = {
  id: 'forge_ghost',
  name: 'Ghost',
  description: 'Create posts and pages on a Ghost site via the Admin API.',
  iconName: 'LuFeather',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'ghost' },
  actions: [
    {
      id: 'post_create',
      label: 'Create post',
      description: 'Create a new post.',
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'html', label: 'HTML', type: 'textarea' },
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
      description: 'List posts from the admin API.',
      fields: [],
      run: postList,
    },
    {
      id: 'page_create',
      label: 'Create page',
      description: 'Create a new page.',
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'html', label: 'HTML', type: 'textarea' },
        { id: 'status', label: 'Status', type: 'select', options: statusOptions, defaultValue: 'draft' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: pageCreate,
    },
    {
      id: 'page_get',
      label: 'Get page',
      description: 'Fetch a page by id.',
      fields: [
        { id: 'pageId', label: 'Page ID', type: 'text', required: true },
      ],
      run: pageGet,
    },
  ],
};

registerForgeBlock(block);
export default block;
