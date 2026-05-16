/**
 * Forge block: Hacker News
 *
 * Source: n8n-master/packages/nodes-base/nodes/HackerNews/HackerNews.node.ts
 * No credential — public Firebase API at https://hacker-news.firebaseio.com/v0/.
 *
 * Operations:
 *   - item.get    GET /item/{id}.json
 *   - user.get    GET /user/{username}.json
 *   - top.list    GET /topstories.json (with client-side limit/page)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const BASE = 'https://hacker-news.firebaseio.com/v0';

async function itemGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.itemId);
  if (!id) throw new Error('Hacker News: itemId is required');
  const res = await apiRequest({
    service: 'Hacker News',
    method: 'GET',
    url: `${BASE}/item/${id}.json`,
  });
  if (res.data === null) throw new Error(`Hacker News: item ${id} not found`);
  return { outputs: { item: res.data }, logs: [`HN item get → ${id}`] };
}

async function userGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const username = asString(ctx.options.username);
  if (!username) throw new Error('Hacker News: username is required');
  const res = await apiRequest({
    service: 'Hacker News',
    method: 'GET',
    url: `${BASE}/user/${username}.json`,
  });
  if (res.data === null) throw new Error(`Hacker News: user ${username} not found`);
  return { outputs: { user: res.data }, logs: [`HN user get → ${username}`] };
}

async function topList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const limit = asNumber(ctx.options.limit) ?? 10;
  const page = asNumber(ctx.options.page) ?? 1;
  const includeItems = String(ctx.options.includeItems ?? 'false').toLowerCase() === 'true';

  const res = await apiRequest({
    service: 'Hacker News',
    method: 'GET',
    url: `${BASE}/topstories.json`,
  });
  const ids = (res.data as number[]) ?? [];
  const start = Math.max(0, (page - 1) * limit);
  const sliced = ids.slice(start, start + limit);

  if (!includeItems) {
    return { outputs: { ids: sliced, total: ids.length }, logs: [`HN top stories → ${sliced.length} ids`] };
  }

  const items = await Promise.all(
    sliced.map(async (id) => {
      const r = await apiRequest({
        service: 'Hacker News',
        method: 'GET',
        url: `${BASE}/item/${id}.json`,
      });
      return r.data;
    }),
  );
  return { outputs: { items, ids: sliced, total: ids.length }, logs: [`HN top stories → ${items.length} items`] };
}

const block: ForgeBlock = {
  id: 'forge_hackernews',
  name: 'Hacker News',
  description: 'Fetch Hacker News items, users and top stories.',
  iconName: 'LuNewspaper',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'item_get',
      label: 'Get item',
      description: 'Fetch a story, comment, ask, job or poll by id.',
      fields: [{ id: 'itemId', label: 'Item ID', type: 'text', required: true }],
      run: itemGet,
    },
    {
      id: 'user_get',
      label: 'Get user',
      fields: [{ id: 'username', label: 'Username', type: 'text', required: true }],
      run: userGet,
    },
    {
      id: 'top_list',
      label: 'List top stories',
      fields: [
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: 10 },
        { id: 'page', label: 'Page', type: 'number', defaultValue: 1 },
        {
          id: 'includeItems',
          label: 'Fetch full item bodies',
          type: 'select',
          options: [
            { label: 'IDs only', value: 'false' },
            { label: 'Full items', value: 'true' },
          ],
          defaultValue: 'false',
        },
      ],
      run: topList,
    },
  ],
};

registerForgeBlock(block);
export default block;
