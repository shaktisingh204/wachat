/**
 * Forge block: Notion.
 *
 * Auth: Notion internal integration token (Bearer).
 * Actions: Create page, Append block, Get database.
 */

import { registerForgeBlock } from '../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../types';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

const buildHeaders = (ctx: ForgeActionContext): Record<string, string> => {
  const token = ctx.credential?.apiToken ?? str(ctx.options.apiToken);
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
};

async function createPage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const parentDatabaseId = str(ctx.options.parentDatabaseId);
  const title = str(ctx.options.title);
  const content = str(ctx.options.content);
  const outputVariable = str(ctx.options.outputVariable);

  const body = {
    parent: { database_id: parentDatabaseId },
    properties: {
      Name: {
        title: [{ type: 'text', text: { content: title } }],
      },
    },
    children: content
      ? [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content } }],
            },
          },
        ]
      : [],
  };

  const res = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: buildHeaders(ctx),
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json();
  if (!res.ok) throw new Error(`Notion create page failed: ${res.status}`);

  const outputs: Record<string, unknown> = {};
  if (outputVariable) outputs[outputVariable] = data;
  return { outputs, logs: [`Notion: created page in database ${parentDatabaseId}`] };
}

async function appendBlock(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const pageId = str(ctx.options.pageId);
  const content = str(ctx.options.content);

  const body = {
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content } }],
        },
      },
    ],
  };

  const res = await fetch(`${NOTION_API}/blocks/${encodeURIComponent(pageId)}/children`, {
    method: 'PATCH',
    headers: buildHeaders(ctx),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Notion append block failed: ${res.status}`);

  return { logs: [`Notion: appended block to page ${pageId}`] };
}

async function getDatabase(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const databaseId = str(ctx.options.databaseId);
  const outputVariable = str(ctx.options.outputVariable);

  const res = await fetch(`${NOTION_API}/databases/${encodeURIComponent(databaseId)}/query`, {
    method: 'POST',
    headers: buildHeaders(ctx),
    body: JSON.stringify({}),
  });
  const data: unknown = await res.json();
  if (!res.ok) throw new Error(`Notion get database failed: ${res.status}`);

  const outputs: Record<string, unknown> = {};
  if (outputVariable) outputs[outputVariable] = data;
  return { outputs, logs: [`Notion: fetched database ${databaseId}`] };
}

const block: ForgeBlock = {
  id: 'forge_notion',
  name: 'Notion',
  description: 'Create pages, append blocks, and query databases in Notion.',
  iconName: 'LuBookOpen',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    fields: [
      {
        id: 'apiToken',
        label: 'Integration Token',
        type: 'password',
        placeholder: 'secret_…',
        helperText: 'Create an internal integration at notion.so/my-integrations and paste the secret.',
        required: true,
      },
    ],
  },
  actions: [
    {
      id: 'create_page',
      label: 'Create Page',
      description: 'Create a new page inside a Notion database.',
      fields: [
        {
          id: 'parentDatabaseId',
          label: 'Database ID',
          type: 'text',
          placeholder: 'database id or {{dbId}}',
          required: true,
        },
        {
          id: 'title',
          label: 'Page Title',
          type: 'text',
          placeholder: 'New entry',
          required: true,
        },
        {
          id: 'content',
          label: 'Body Content',
          type: 'textarea',
          placeholder: 'Supports {{variables}}.',
        },
        {
          id: 'outputVariable',
          label: 'Save response to variable',
          type: 'variable',
          placeholder: 'notionPage',
        },
      ],
      run: createPage,
    },
    {
      id: 'append_block',
      label: 'Append Block',
      description: 'Append a paragraph block to an existing Notion page.',
      fields: [
        {
          id: 'pageId',
          label: 'Page ID',
          type: 'text',
          placeholder: 'page id or {{pageId}}',
          required: true,
        },
        {
          id: 'content',
          label: 'Paragraph Content',
          type: 'textarea',
          required: true,
        },
      ],
      run: appendBlock,
    },
    {
      id: 'get_database',
      label: 'Get Database',
      description: 'Query a Notion database and save the rows to a variable.',
      fields: [
        {
          id: 'databaseId',
          label: 'Database ID',
          type: 'text',
          placeholder: 'database id',
          required: true,
        },
        {
          id: 'outputVariable',
          label: 'Save rows to variable',
          type: 'variable',
          placeholder: 'notionRows',
          required: true,
        },
      ],
      run: getDatabase,
    },
  ],
};

registerForgeBlock(block);

export default block;
