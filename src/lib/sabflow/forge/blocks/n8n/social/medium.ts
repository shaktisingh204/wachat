/**
 * Forge block: Medium
 *
 * Source: n8n-master/packages/nodes-base/nodes/Medium/Medium.node.ts
 * Credential type: 'medium' (CREDENTIAL_FIELD_SCHEMAS → { accessToken })
 *
 * Operations:
 *   - user.me              GET  /v1/me
 *   - post.create_user     POST /v1/users/{authorId}/posts
 *   - post.create_pub      POST /v1/publications/{publicationId}/posts
 *   - publication.list     GET  /v1/users/{userId}/publications
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.medium.com/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('Medium', ctx.credential);
  const token = cred.accessToken;
  if (!token) throw new Error('Medium: credential is missing `accessToken`');
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

async function userMe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Medium',
    method: 'GET',
    url: `${BASE}/me`,
    headers: authHeaders(ctx),
  });
  const data = res.data as { data?: unknown };
  return { outputs: { user: data.data ?? res.data }, logs: ['Medium /me'] };
}

function buildPostBody(ctx: ForgeActionContext): Record<string, unknown> {
  const title = asString(ctx.options.title);
  const content = asString(ctx.options.content);
  if (!title) throw new Error('Medium: title is required');
  if (!content) throw new Error('Medium: content is required');

  const body: Record<string, unknown> = {
    title,
    content,
    contentFormat: asString(ctx.options.contentFormat) || 'html',
    publishStatus: asString(ctx.options.publishStatus) || 'draft',
  };
  const tagsRaw = asString(ctx.options.tags);
  if (tagsRaw) body.tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
  if (asString(ctx.options.canonicalUrl)) body.canonicalUrl = asString(ctx.options.canonicalUrl);
  if (asString(ctx.options.license)) body.license = asString(ctx.options.license);
  return body;
}

async function postCreateUser(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const authorId = asString(ctx.options.authorId);
  if (!authorId) throw new Error('Medium: authorId is required');
  const res = await apiRequest({
    service: 'Medium',
    method: 'POST',
    url: `${BASE}/users/${encodeURIComponent(authorId)}/posts`,
    headers: authHeaders(ctx),
    json: buildPostBody(ctx),
  });
  const data = res.data as { data?: { id?: string } };
  return { outputs: { post: data.data ?? res.data }, logs: [`Medium post → ${data.data?.id ?? '?'}`] };
}

async function postCreatePub(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const publicationId = asString(ctx.options.publicationId);
  if (!publicationId) throw new Error('Medium: publicationId is required');
  const res = await apiRequest({
    service: 'Medium',
    method: 'POST',
    url: `${BASE}/publications/${encodeURIComponent(publicationId)}/posts`,
    headers: authHeaders(ctx),
    json: buildPostBody(ctx),
  });
  const data = res.data as { data?: { id?: string } };
  return { outputs: { post: data.data ?? res.data }, logs: [`Medium pub post → ${data.data?.id ?? '?'}`] };
}

async function publicationList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const userId = asString(ctx.options.userId);
  if (!userId) throw new Error('Medium: userId is required');
  const res = await apiRequest({
    service: 'Medium',
    method: 'GET',
    url: `${BASE}/users/${encodeURIComponent(userId)}/publications`,
    headers: authHeaders(ctx),
  });
  const data = res.data as { data?: unknown };
  return { outputs: { publications: data.data ?? res.data }, logs: [`Medium publications → ${userId}`] };
}

const POST_FIELDS = [
  { id: 'title', label: 'Title', type: 'text' as const, required: true },
  { id: 'content', label: 'Content', type: 'textarea' as const, required: true },
  {
    id: 'contentFormat',
    label: 'Content format',
    type: 'select' as const,
    options: [
      { label: 'HTML', value: 'html' },
      { label: 'Markdown', value: 'markdown' },
    ],
    defaultValue: 'html',
  },
  {
    id: 'publishStatus',
    label: 'Publish status',
    type: 'select' as const,
    options: [
      { label: 'Draft', value: 'draft' },
      { label: 'Public', value: 'public' },
      { label: 'Unlisted', value: 'unlisted' },
    ],
    defaultValue: 'draft',
  },
  { id: 'tags', label: 'Tags (comma-separated)', type: 'text' as const },
  { id: 'canonicalUrl', label: 'Canonical URL', type: 'text' as const },
  { id: 'license', label: 'License', type: 'text' as const },
];

const block: ForgeBlock = {
  id: 'forge_medium',
  name: 'Medium',
  description: 'Publish posts to Medium personal or publication accounts.',
  iconName: 'LuFileText',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'medium' },
  actions: [
    {
      id: 'user_me',
      label: 'Get authenticated user',
      description: 'Return the user the token belongs to.',
      fields: [],
      run: userMe,
    },
    {
      id: 'post_create_user',
      label: 'Create post (personal)',
      description: 'Publish a post under a user account.',
      fields: [
        { id: 'authorId', label: 'Author ID', type: 'text', required: true },
        ...POST_FIELDS,
      ],
      run: postCreateUser,
    },
    {
      id: 'post_create_pub',
      label: 'Create post (publication)',
      description: 'Publish a post under a publication.',
      fields: [
        { id: 'publicationId', label: 'Publication ID', type: 'text', required: true },
        ...POST_FIELDS,
      ],
      run: postCreatePub,
    },
    {
      id: 'publication_list',
      label: 'List publications',
      description: 'List publications the user contributes to.',
      fields: [
        { id: 'userId', label: 'User ID', type: 'text', required: true },
      ],
      run: publicationList,
    },
  ],
};

registerForgeBlock(block);
export default block;
