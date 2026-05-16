/**
 * Forge block: Google Chat
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/Chat/GoogleChat.node.ts
 * Credential type: 'google_chat' — { clientId, clientSecret, refreshToken }
 *
 * Operations:
 *   - space.list     GET  /v1/spaces
 *   - space.get      GET  /v1/{name}                  (e.g. spaces/AAAAAAAAAAA)
 *   - message.create POST /v1/{parent}/messages       (parent = spaces/XXX)
 *   - message.get    GET  /v1/{name}                  (messages/AAA)
 *   - message.delete DELETE /v1/{name}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import { getOrRefreshAccessToken, GOOGLE_TOKEN_URL } from '../_shared/google_oauth';

const BASE = 'https://chat.googleapis.com/v1';
const SERVICE = 'Google Chat';

async function call(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const token = await getOrRefreshAccessToken(SERVICE, ctx.credential, GOOGLE_TOKEN_URL);
  const res = await apiRequest({
    service: SERVICE,
    method,
    url: `${BASE}${path}`,
    headers: { Authorization: `Bearer ${token}` },
    json,
  });
  return res.data;
}

async function spaceList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await call(ctx, 'GET', `/spaces`);
  return { outputs: { result: data }, logs: ['Chat spaces list'] };
}

async function spaceGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error(`${SERVICE}: name is required (e.g. spaces/AAAAA)`);
  const data = await call(ctx, 'GET', `/${name}`);
  return { outputs: { result: data }, logs: [`Chat space get → ${name}`] };
}

async function messageCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const parent = asString(ctx.options.parent);
  const text = asString(ctx.options.text);
  if (!parent) throw new Error(`${SERVICE}: parent is required (e.g. spaces/AAAAA)`);
  if (!text) throw new Error(`${SERVICE}: text is required`);
  const body: Record<string, unknown> = { text };
  const data = await call(ctx, 'POST', `/${parent}/messages`, body);
  return { outputs: { result: data }, logs: [`Chat message create → ${parent}`] };
}

async function messageGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error(`${SERVICE}: name is required (e.g. spaces/AAA/messages/BBB)`);
  const data = await call(ctx, 'GET', `/${name}`);
  return { outputs: { result: data }, logs: [`Chat message get → ${name}`] };
}

async function messageDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error(`${SERVICE}: name is required`);
  const data = await call(ctx, 'DELETE', `/${name}`);
  return { outputs: { result: data }, logs: [`Chat message delete → ${name}`] };
}

const block: ForgeBlock = {
  id: 'forge_google_chat',
  name: 'Google Chat',
  description: 'Send messages and manage spaces in Google Chat.',
  iconName: 'LuMessageSquare',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'google_chat' },
  actions: [
    {
      id: 'space_list',
      label: 'List spaces',
      description: 'List Chat spaces visible to the user.',
      fields: [],
      run: spaceList,
    },
    {
      id: 'space_get',
      label: 'Get space',
      description: 'Get a Chat space by name (e.g. spaces/AAAAA).',
      fields: [{ id: 'name', label: 'Space name', type: 'text', required: true, placeholder: 'spaces/AAAAA' }],
      run: spaceGet,
    },
    {
      id: 'message_create',
      label: 'Send message',
      description: 'Send a text message into a Chat space.',
      fields: [
        { id: 'parent', label: 'Space (parent)', type: 'text', required: true, placeholder: 'spaces/AAAAA' },
        { id: 'text', label: 'Message text', type: 'textarea', required: true },
      ],
      run: messageCreate,
    },
    {
      id: 'message_get',
      label: 'Get message',
      description: 'Fetch a single message by resource name.',
      fields: [
        {
          id: 'name',
          label: 'Message name',
          type: 'text',
          required: true,
          placeholder: 'spaces/AAA/messages/BBB',
        },
      ],
      run: messageGet,
    },
    {
      id: 'message_delete',
      label: 'Delete message',
      description: 'Delete a message by resource name.',
      fields: [
        { id: 'name', label: 'Message name', type: 'text', required: true },
      ],
      run: messageDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
