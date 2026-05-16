/**
 * Forge block: Disqus
 *
 * Source: n8n-master/packages/nodes-base/nodes/Disqus/Disqus.node.ts
 * Credential type: 'disqus' (CREDENTIAL_FIELD_SCHEMAS → { apiKey, apiSecret, accessToken? })
 *
 * Operations (all GET):
 *   - thread.list       /api/3.0/threads/list.json
 *   - thread.details    /api/3.0/threads/details.json
 *   - post.list         /api/3.0/posts/list.json
 *   - forum.list        /api/3.0/forums/listForums.json
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://disqus.com/api/3.0';

function authParams(ctx: ForgeActionContext): URLSearchParams {
  const cred = requireCredential('Disqus', ctx.credential);
  const apiKey = cred.apiKey;
  if (!apiKey) throw new Error('Disqus: credential is missing `apiKey`');
  const params = new URLSearchParams();
  params.set('api_key', apiKey);
  if (cred.accessToken) params.set('access_token', cred.accessToken);
  return params;
}

async function disqusGet(ctx: ForgeActionContext, path: string, extra: Record<string, string>): Promise<unknown> {
  const params = authParams(ctx);
  for (const [k, v] of Object.entries(extra)) {
    if (v !== '') params.set(k, v);
  }
  const res = await apiRequest({
    service: 'Disqus',
    method: 'GET',
    url: `${BASE}${path}?${params.toString()}`,
  });
  return res.data;
}

async function threadList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await disqusGet(ctx, '/threads/list.json', {
    forum: asString(ctx.options.forum),
    limit: asString(ctx.options.limit) || '25',
  });
  return { outputs: { threads: data }, logs: ['Disqus threads/list'] };
}

async function threadDetails(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const threadId = asString(ctx.options.threadId);
  if (!threadId) throw new Error('Disqus: threadId is required');
  const data = await disqusGet(ctx, '/threads/details.json', { thread: threadId });
  return { outputs: { thread: data }, logs: [`Disqus threads/details → ${threadId}`] };
}

async function postList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await disqusGet(ctx, '/posts/list.json', {
    forum: asString(ctx.options.forum),
    thread: asString(ctx.options.threadId),
    limit: asString(ctx.options.limit) || '25',
  });
  return { outputs: { posts: data }, logs: ['Disqus posts/list'] };
}

async function forumList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await disqusGet(ctx, '/forums/listForums.json', {
    limit: asString(ctx.options.limit) || '25',
  });
  return { outputs: { forums: data }, logs: ['Disqus forums/listForums'] };
}

const block: ForgeBlock = {
  id: 'forge_disqus',
  name: 'Disqus',
  description: 'Read Disqus threads, posts and forums.',
  iconName: 'LuMessagesSquare',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'disqus' },
  actions: [
    {
      id: 'thread_list',
      label: 'List threads',
      description: 'List threads on a forum.',
      fields: [
        { id: 'forum', label: 'Forum shortname', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: '25' },
      ],
      run: threadList,
    },
    {
      id: 'thread_details',
      label: 'Get thread details',
      description: 'Fetch details for a single thread.',
      fields: [
        { id: 'threadId', label: 'Thread ID', type: 'text', required: true },
      ],
      run: threadDetails,
    },
    {
      id: 'post_list',
      label: 'List posts',
      description: 'List posts on a forum or thread.',
      fields: [
        { id: 'forum', label: 'Forum shortname', type: 'text' },
        { id: 'threadId', label: 'Thread ID', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: '25' },
      ],
      run: postList,
    },
    {
      id: 'forum_list',
      label: 'List forums',
      description: 'List forums the user can access.',
      fields: [
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: '25' },
      ],
      run: forumList,
    },
  ],
};

registerForgeBlock(block);
export default block;
