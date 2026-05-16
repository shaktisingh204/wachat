/**
 * Forge block: LinkedIn
 *
 * Source: n8n-master/packages/nodes-base/nodes/LinkedIn/LinkedIn.node.ts
 * Credential type: 'linkedin' (CREDENTIAL_FIELD_SCHEMAS → { accessToken, userId? })
 *
 * Operations:
 *   - profile.me        GET  /v2/userinfo (OIDC) — modern endpoint that works
 *                       with the new Sign In with LinkedIn product.
 *   - post.create       POST /v2/ugcPosts (text post on the authenticated user's profile)
 *
 * Notes:
 *   - LinkedIn's API splits posts between `ugcPosts` (legacy) and `posts`
 *     (Versioned API). We use ugcPosts because n8n's port does the same.
 *   - The author URN is read from `credential.userId` (preferred) or
 *     `ctx.options.authorUrn` (override). Both expect e.g. `urn:li:person:abc`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.linkedin.com/v2';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const cred = requireCredential('LinkedIn', ctx.credential);
  const token = cred.accessToken;
  if (!token) throw new Error('LinkedIn: credential is missing `accessToken`');
  return {
    Authorization: `Bearer ${token}`,
    'X-Restli-Protocol-Version': '2.0.0',
  };
}

function resolveAuthorUrn(ctx: ForgeActionContext): string {
  const override = asString(ctx.options.authorUrn);
  if (override) return override;
  const cred = ctx.credential ?? {};
  const userId = asString(cred.userId);
  if (!userId) {
    throw new Error('LinkedIn: author URN missing — set credential.userId or pass authorUrn');
  }
  return userId.startsWith('urn:li:person:') ? userId : `urn:li:person:${userId}`;
}

async function profileMe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'LinkedIn',
    method: 'GET',
    url: 'https://api.linkedin.com/v2/userinfo',
    headers: authHeaders(ctx),
  });
  return { outputs: { profile: res.data }, logs: ['LinkedIn /v2/userinfo'] };
}

async function postCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  if (!text) throw new Error('LinkedIn: text is required');
  const author = resolveAuthorUrn(ctx);
  const visibility = (asString(ctx.options.visibility) || 'PUBLIC').toUpperCase();

  const body = {
    author,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': visibility },
  };

  const res = await apiRequest({
    service: 'LinkedIn',
    method: 'POST',
    url: `${BASE}/ugcPosts`,
    headers: authHeaders(ctx),
    json: body,
  });
  const id = res.headers.get('x-restli-id') ?? (res.data as { id?: string })?.id;
  return { outputs: { post: res.data, id }, logs: [`LinkedIn ugcPost → ${id ?? '?'}`] };
}

const block: ForgeBlock = {
  id: 'forge_linkedin',
  name: 'LinkedIn',
  description: 'Post on LinkedIn and read profile info.',
  iconName: 'LuLinkedin',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'linkedin' },
  actions: [
    {
      id: 'profile_me',
      label: 'Get authenticated user',
      description: 'Return the OIDC userinfo for the access token.',
      fields: [],
      run: profileMe,
    },
    {
      id: 'post_create',
      label: 'Create text post',
      description: 'Publish a text post on the authenticated profile.',
      fields: [
        { id: 'text', label: 'Post text', type: 'textarea', required: true },
        {
          id: 'authorUrn',
          label: 'Author URN (override)',
          type: 'text',
          placeholder: 'urn:li:person:xxxxxxxx',
          helperText: 'Leave blank to use the userId stored on the credential.',
        },
        {
          id: 'visibility',
          label: 'Visibility',
          type: 'select',
          options: [
            { label: 'Public', value: 'PUBLIC' },
            { label: 'Connections only', value: 'CONNECTIONS' },
          ],
          defaultValue: 'PUBLIC',
        },
      ],
      run: postCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
