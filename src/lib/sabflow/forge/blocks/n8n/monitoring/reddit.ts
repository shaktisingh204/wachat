/**
 * Forge block: Reddit
 *
 * Source: n8n-master/packages/nodes-base/nodes/Reddit/Reddit.node.ts
 * Credential type: 'reddit' → { clientId, clientSecret, username, password }.
 *
 * Auth: OAuth password grant against https://www.reddit.com/api/v1/access_token
 * using Basic auth (clientId:clientSecret). Cached for the action call.
 *
 * Operations:
 *   - post.submit         POST /api/submit
 *   - post.get            GET  /comments/{id}
 *   - subreddit.hot       GET  /r/{subreddit}/hot
 *   - comment.create      POST /api/comment
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const OAUTH_BASE = 'https://oauth.reddit.com';
const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const USER_AGENT = 'sabflow:forge.reddit:v1 (by SabFlow)';

async function getAccessToken(ctx: ForgeActionContext): Promise<string> {
  const cred = requireCredential('Reddit', ctx.credential);
  const { clientId = '', clientSecret = '', username = '', password = '' } = cred;
  if (!clientId || !clientSecret) throw new Error('Reddit: credential needs clientId + clientSecret');
  if (!username || !password) throw new Error('Reddit: credential needs username + password');

  const basic = btoa(`${clientId}:${clientSecret}`);
  const form = new URLSearchParams({ grant_type: 'password', username, password });

  const res = await apiRequest({
    service: 'Reddit',
    method: 'POST',
    url: TOKEN_URL,
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: form.toString(),
  });
  const token = (res.data as { access_token?: string }).access_token;
  if (!token) throw new Error('Reddit: token exchange returned no access_token');
  return token;
}

async function redditRequest(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST',
  path: string,
  formBody?: URLSearchParams,
): Promise<unknown> {
  const token = await getAccessToken(ctx);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  };
  let url = `${OAUTH_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  let body: string | undefined;
  if (formBody) {
    if (method === 'GET') {
      const qs = formBody.toString();
      if (qs) url += url.includes('?') ? `&${qs}` : `?${qs}`;
    } else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = formBody.toString();
    }
  }
  const res = await apiRequest({ service: 'Reddit', method, url, headers, body });
  return res.data;
}

async function postSubmit(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const subreddit = asString(ctx.options.subreddit);
  const title = asString(ctx.options.title);
  const kind = asString(ctx.options.kind) || 'self';
  if (!subreddit) throw new Error('Reddit: subreddit is required');
  if (!title) throw new Error('Reddit: title is required');

  const form = new URLSearchParams({ sr: subreddit, title, kind, api_type: 'json' });
  if (kind === 'self') {
    const text = asString(ctx.options.text);
    if (text) form.set('text', text);
  } else if (kind === 'link') {
    const url = asString(ctx.options.url);
    if (!url) throw new Error('Reddit: url is required when kind=link');
    form.set('url', url);
  }

  const data = await redditRequest(ctx, 'POST', '/api/submit', form);
  return { outputs: { result: data }, logs: [`Reddit post submit → r/${subreddit}`] };
}

async function postGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.postId);
  if (!id) throw new Error('Reddit: postId is required');
  const data = await redditRequest(ctx, 'GET', `/comments/${id}`);
  return { outputs: { post: data }, logs: [`Reddit post get → ${id}`] };
}

async function subredditHot(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const subreddit = asString(ctx.options.subreddit);
  if (!subreddit) throw new Error('Reddit: subreddit is required');
  const limit = asString(ctx.options.limit);
  const params = new URLSearchParams();
  if (limit) params.set('limit', limit);
  const data = await redditRequest(ctx, 'GET', `/r/${subreddit}/hot`, params);
  return { outputs: { listing: data }, logs: [`Reddit subreddit hot → r/${subreddit}`] };
}

async function commentCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const thingId = asString(ctx.options.thingId);
  const text = asString(ctx.options.text);
  if (!thingId) throw new Error('Reddit: thingId (e.g. t3_…) is required');
  if (!text) throw new Error('Reddit: text is required');

  const form = new URLSearchParams({ thing_id: thingId, text, api_type: 'json' });
  const data = await redditRequest(ctx, 'POST', '/api/comment', form);
  return { outputs: { result: data }, logs: [`Reddit comment → ${thingId}`] };
}

const block: ForgeBlock = {
  id: 'forge_reddit',
  name: 'Reddit',
  description: 'Submit posts, fetch listings and comment on Reddit.',
  iconName: 'LuMessageSquare',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'reddit' },
  actions: [
    {
      id: 'post_submit',
      label: 'Submit post',
      fields: [
        { id: 'subreddit', label: 'Subreddit (no /r/)', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text', required: true },
        {
          id: 'kind',
          label: 'Kind',
          type: 'select',
          options: [
            { label: 'Self (text)', value: 'self' },
            { label: 'Link', value: 'link' },
          ],
        },
        { id: 'text', label: 'Body (self posts)', type: 'textarea' },
        { id: 'url', label: 'URL (link posts)', type: 'text' },
      ],
      run: postSubmit,
    },
    {
      id: 'post_get',
      label: 'Get post',
      fields: [{ id: 'postId', label: 'Post ID (base36)', type: 'text', required: true }],
      run: postGet,
    },
    {
      id: 'subreddit_hot',
      label: 'List hot posts in subreddit',
      fields: [
        { id: 'subreddit', label: 'Subreddit', type: 'text', required: true },
        { id: 'limit', label: 'Limit', type: 'number', placeholder: '25' },
      ],
      run: subredditHot,
    },
    {
      id: 'comment_create',
      label: 'Create comment',
      fields: [
        { id: 'thingId', label: 'Parent ID (t1_/t3_…)', type: 'text', required: true },
        { id: 'text', label: 'Text', type: 'textarea', required: true },
      ],
      run: commentCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
