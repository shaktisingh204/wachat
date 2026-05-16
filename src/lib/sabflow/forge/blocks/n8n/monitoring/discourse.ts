/**
 * Forge block: Discourse
 *
 * Source: n8n-master/packages/nodes-base/nodes/Discourse/Discourse.node.ts
 * Credential type: 'discourse' → { baseUrl, apiKey, apiUsername }.
 *
 * Operations:
 *   - topic.list     GET  /latest.json
 *   - topic.get      GET  /t/{id}.json
 *   - topic.create   POST /posts.json    (with title + raw + category)
 *   - post.create    POST /posts.json    (reply: topic_id + raw)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential, type HttpMethod } from '../_shared/http';

function dsAuth(ctx: ForgeActionContext): { base: string; headers: Record<string, string> } {
  const cred = requireCredential('Discourse', ctx.credential);
  const base = (cred.baseUrl ?? '').replace(/\/+$/, '');
  const apiKey = cred.apiKey ?? '';
  const apiUsername = cred.apiUsername ?? '';
  if (!base) throw new Error('Discourse: credential is missing `baseUrl`');
  if (!apiKey || !apiUsername) throw new Error('Discourse: credential needs apiKey + apiUsername');
  return {
    base,
    headers: {
      'Api-Key': apiKey,
      'Api-Username': apiUsername,
      Accept: 'application/json',
    },
  };
}

async function dsRequest(
  ctx: ForgeActionContext,
  method: HttpMethod,
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { base, headers } = dsAuth(ctx);
  const res = await apiRequest({
    service: 'Discourse',
    method,
    url: `${base}${path.startsWith('/') ? path : `/${path}`}`,
    headers,
    json,
  });
  return res.data;
}

async function topicList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await dsRequest(ctx, 'GET', '/latest.json');
  return { outputs: { topics: (data as { topic_list?: unknown }).topic_list ?? data }, logs: ['Discourse topic list'] };
}

async function topicGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.topicId);
  if (!id) throw new Error('Discourse: topicId is required');
  const data = await dsRequest(ctx, 'GET', `/t/${id}.json`);
  return { outputs: { topic: data }, logs: [`Discourse topic get → ${id}`] };
}

async function topicCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  const raw = asString(ctx.options.raw);
  if (!title) throw new Error('Discourse: title is required');
  if (!raw) throw new Error('Discourse: raw (body) is required');

  const body: Record<string, unknown> = { title, raw };
  const categoryId = asString(ctx.options.categoryId);
  if (categoryId) body.category = Number(categoryId);

  const data = await dsRequest(ctx, 'POST', '/posts.json', body);
  return { outputs: { post: data }, logs: [`Discourse topic create → ${title}`] };
}

async function postCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const topicId = asString(ctx.options.topicId);
  const raw = asString(ctx.options.raw);
  if (!topicId) throw new Error('Discourse: topicId is required');
  if (!raw) throw new Error('Discourse: raw (body) is required');

  const body: Record<string, unknown> = { topic_id: Number(topicId), raw };
  const replyToPostNumber = asString(ctx.options.replyToPostNumber);
  if (replyToPostNumber) body.reply_to_post_number = Number(replyToPostNumber);

  const data = await dsRequest(ctx, 'POST', '/posts.json', body);
  return { outputs: { post: data }, logs: [`Discourse post create → t${topicId}`] };
}

const block: ForgeBlock = {
  id: 'forge_discourse',
  name: 'Discourse',
  description: 'Read and post to a Discourse forum from a flow.',
  iconName: 'LuMessagesSquare',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'discourse' },
  actions: [
    {
      id: 'topic_list',
      label: 'List latest topics',
      fields: [],
      run: topicList,
    },
    {
      id: 'topic_get',
      label: 'Get topic',
      fields: [{ id: 'topicId', label: 'Topic ID', type: 'text', required: true }],
      run: topicGet,
    },
    {
      id: 'topic_create',
      label: 'Create topic',
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'raw', label: 'Body (markdown)', type: 'textarea', required: true },
        { id: 'categoryId', label: 'Category ID', type: 'number' },
      ],
      run: topicCreate,
    },
    {
      id: 'post_create',
      label: 'Reply to topic',
      fields: [
        { id: 'topicId', label: 'Topic ID', type: 'text', required: true },
        { id: 'raw', label: 'Body (markdown)', type: 'textarea', required: true },
        { id: 'replyToPostNumber', label: 'Reply to post number', type: 'number' },
      ],
      run: postCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
