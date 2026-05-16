/**
 * Forge block: Notion V2 (extended actions)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Notion/v2/NotionV2.node.ts
 *
 * Notion integration token (`secret_…`) passed inline. Covers ops not in
 * the primary notion block: search, page-property updates, comments, users.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.notion.com/v1';

function headers(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.notionToken);
  if (!token) throw new Error('Notion: notionToken is required');
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
  };
}

async function search(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.query);
  const body: Record<string, unknown> = {};
  if (query) body.query = query;
  const res = await apiRequest({
    service: 'Notion',
    method: 'POST',
    url: `${API}/search`,
    headers: headers(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Notion search → ${query || '(all)'}`] };
}

async function commentCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const pageId = asString(ctx.options.pageId);
  const text = asString(ctx.options.text);
  if (!pageId || !text) throw new Error('Notion: pageId and text are required');
  const res = await apiRequest({
    service: 'Notion',
    method: 'POST',
    url: `${API}/comments`,
    headers: headers(ctx),
    json: {
      parent: { page_id: pageId },
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  });
  return { outputs: { comment: res.data }, logs: [`Notion comment → ${pageId}`] };
}

async function userList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Notion',
    method: 'GET',
    url: `${API}/users`,
    headers: headers(ctx),
  });
  return { outputs: { users: res.data }, logs: ['Notion users list'] };
}

async function pageArchive(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const pageId = asString(ctx.options.pageId);
  if (!pageId) throw new Error('Notion: pageId is required');
  const res = await apiRequest({
    service: 'Notion',
    method: 'PATCH',
    url: `${API}/pages/${encodeURIComponent(pageId)}`,
    headers: headers(ctx),
    json: { archived: true },
  });
  return { outputs: { page: res.data }, logs: [`Notion page archive → ${pageId}`] };
}

const block: ForgeBlock = {
  id: 'forge_notion_v2_actions',
  name: 'Notion V2 (extended)',
  description: 'Extra Notion ops (search, comments, users, archive).',
  iconName: 'LuBookOpen',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'search',
      label: 'Search workspace',
      fields: [
        { id: 'notionToken', label: 'Integration token', type: 'password', required: true },
        { id: 'query', label: 'Query', type: 'text' },
      ],
      run: search,
    },
    {
      id: 'comment_create',
      label: 'Add comment to page',
      fields: [
        { id: 'notionToken', label: 'Integration token', type: 'password', required: true },
        { id: 'pageId', label: 'Page ID', type: 'text', required: true },
        { id: 'text', label: 'Comment text', type: 'textarea', required: true },
      ],
      run: commentCreate,
    },
    {
      id: 'user_list',
      label: 'List users',
      fields: [
        { id: 'notionToken', label: 'Integration token', type: 'password', required: true },
      ],
      run: userList,
    },
    {
      id: 'page_archive',
      label: 'Archive page',
      fields: [
        { id: 'notionToken', label: 'Integration token', type: 'password', required: true },
        { id: 'pageId', label: 'Page ID', type: 'text', required: true },
      ],
      run: pageArchive,
    },
  ],
};

registerForgeBlock(block);
export default block;
