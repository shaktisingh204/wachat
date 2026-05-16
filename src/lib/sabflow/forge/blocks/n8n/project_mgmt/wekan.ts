/**
 * Forge block: Wekan
 *
 * Source: n8n-master/packages/nodes-base/nodes/Wekan/Wekan.node.ts
 * Credential type: 'wekan' (CREDENTIAL_FIELD_SCHEMAS → { baseUrl, username, password }).
 *
 * Operations covered (card + comment subset). Wekan uses /api/users/login to mint
 * a bearer token from username/password; we cache it per-call (no shared cache yet).
 *
 *   - card.create   POST   /api/boards/{boardId}/lists/{listId}/cards
 *   - card.get      GET    /api/boards/{boardId}/lists/{listId}/cards/{cardId}
 *   - card.update   PUT    /api/boards/{boardId}/lists/{listId}/cards/{cardId}
 *   - card.delete   DELETE /api/boards/{boardId}/lists/{listId}/cards/{cardId}
 *   - card.addComment POST /api/boards/{boardId}/cards/{cardId}/comments
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

type WekanCred = { baseUrl: string; username: string; password: string };

function getCred(ctx: ForgeActionContext): WekanCred {
  const cred = requireCredential('Wekan', ctx.credential);
  const baseUrl = (cred.baseUrl ?? cred.url ?? '').replace(/\/+$/, '');
  const username = cred.username;
  const password = cred.password;
  if (!baseUrl) throw new Error('Wekan: credential is missing `baseUrl`');
  if (!username || !password) throw new Error('Wekan: credential is missing `username` / `password`');
  return { baseUrl, username, password };
}

async function login(c: WekanCred): Promise<string> {
  const res = await apiRequest({
    service: 'Wekan',
    method: 'POST',
    url: `${c.baseUrl}/users/login`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(c.username)}&password=${encodeURIComponent(c.password)}`,
  });
  const body = res.data as { token?: string };
  if (!body?.token) throw new Error('Wekan: login did not return a token');
  return body.token;
}

async function authHeaders(c: WekanCred): Promise<Record<string, string>> {
  const token = await login(c);
  return { Authorization: `Bearer ${token}` };
}

async function cardCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const boardId = asString(ctx.options.boardId);
  const listId = asString(ctx.options.listId);
  const title = asString(ctx.options.title);
  const swimlaneId = asString(ctx.options.swimlaneId);
  const authorId = asString(ctx.options.authorId);
  if (!boardId || !listId) throw new Error('Wekan: boardId and listId are required');
  if (!title) throw new Error('Wekan: title is required');
  if (!swimlaneId) throw new Error('Wekan: swimlaneId is required');
  if (!authorId) throw new Error('Wekan: authorId is required');

  const headers = await authHeaders(c);
  const body: Record<string, unknown> = { title, swimlaneId, authorId };
  const description = asString(ctx.options.description);
  if (description) body.description = description;

  const res = await apiRequest({
    service: 'Wekan',
    method: 'POST',
    url: `${c.baseUrl}/api/boards/${encodeURIComponent(boardId)}/lists/${encodeURIComponent(listId)}/cards`,
    headers,
    json: body,
  });
  return { outputs: { card: res.data }, logs: [`Wekan card create → ${(res.data as { _id?: string })?._id}`] };
}

async function cardGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const boardId = asString(ctx.options.boardId);
  const listId = asString(ctx.options.listId);
  const cardId = asString(ctx.options.cardId);
  if (!boardId || !listId || !cardId) throw new Error('Wekan: boardId, listId, cardId all required');
  const headers = await authHeaders(c);
  const res = await apiRequest({
    service: 'Wekan',
    method: 'GET',
    url: `${c.baseUrl}/api/boards/${encodeURIComponent(boardId)}/lists/${encodeURIComponent(listId)}/cards/${encodeURIComponent(cardId)}`,
    headers,
  });
  return { outputs: { card: res.data }, logs: [`Wekan card get → ${cardId}`] };
}

async function cardUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const boardId = asString(ctx.options.boardId);
  const listId = asString(ctx.options.listId);
  const cardId = asString(ctx.options.cardId);
  if (!boardId || !listId || !cardId) throw new Error('Wekan: boardId, listId, cardId all required');

  const body: Record<string, unknown> = {};
  for (const key of ['title', 'description', 'color', 'dueAt'] as const) {
    const v = asString(ctx.options[key]);
    if (v) body[key] = v;
  }
  if (Object.keys(body).length === 0) {
    throw new Error('Wekan: at least one updatable field must be set');
  }
  const headers = await authHeaders(c);
  const res = await apiRequest({
    service: 'Wekan',
    method: 'PUT',
    url: `${c.baseUrl}/api/boards/${encodeURIComponent(boardId)}/lists/${encodeURIComponent(listId)}/cards/${encodeURIComponent(cardId)}`,
    headers,
    json: body,
  });
  return { outputs: { card: res.data }, logs: [`Wekan card update → ${cardId}`] };
}

async function cardDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const boardId = asString(ctx.options.boardId);
  const listId = asString(ctx.options.listId);
  const cardId = asString(ctx.options.cardId);
  if (!boardId || !listId || !cardId) throw new Error('Wekan: boardId, listId, cardId all required');
  const headers = await authHeaders(c);
  await apiRequest({
    service: 'Wekan',
    method: 'DELETE',
    url: `${c.baseUrl}/api/boards/${encodeURIComponent(boardId)}/lists/${encodeURIComponent(listId)}/cards/${encodeURIComponent(cardId)}`,
    headers,
  });
  return { outputs: { success: true }, logs: [`Wekan card delete → ${cardId}`] };
}

async function cardAddComment(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const boardId = asString(ctx.options.boardId);
  const cardId = asString(ctx.options.cardId);
  const authorId = asString(ctx.options.authorId);
  const comment = asString(ctx.options.comment);
  if (!boardId || !cardId) throw new Error('Wekan: boardId and cardId are required');
  if (!authorId) throw new Error('Wekan: authorId is required');
  if (!comment) throw new Error('Wekan: comment is required');
  const headers = await authHeaders(c);
  const res = await apiRequest({
    service: 'Wekan',
    method: 'POST',
    url: `${c.baseUrl}/api/boards/${encodeURIComponent(boardId)}/cards/${encodeURIComponent(cardId)}/comments`,
    headers,
    json: { authorId, comment },
  });
  return { outputs: { comment: res.data }, logs: [`Wekan comment → ${cardId}`] };
}

const block: ForgeBlock = {
  id: 'forge_wekan',
  name: 'Wekan',
  description: 'Create, update and comment on Wekan cards from a flow.',
  iconName: 'LuTrello',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'wekan' },
  actions: [
    {
      id: 'card_create',
      label: 'Create card',
      description: 'Create a new card on a board list.',
      fields: [
        { id: 'boardId', label: 'Board ID', type: 'text', required: true },
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'swimlaneId', label: 'Swimlane ID', type: 'text', required: true },
        { id: 'authorId', label: 'Author user ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea' },
      ],
      run: cardCreate,
    },
    {
      id: 'card_get',
      label: 'Get card',
      description: 'Fetch a single card by id.',
      fields: [
        { id: 'boardId', label: 'Board ID', type: 'text', required: true },
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'cardId', label: 'Card ID', type: 'text', required: true },
      ],
      run: cardGet,
    },
    {
      id: 'card_update',
      label: 'Update card',
      description: 'Patch a card. Only set fields are sent.',
      fields: [
        { id: 'boardId', label: 'Board ID', type: 'text', required: true },
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'cardId', label: 'Card ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'color', label: 'Color', type: 'text' },
        { id: 'dueAt', label: 'Due at (ISO 8601)', type: 'text' },
      ],
      run: cardUpdate,
    },
    {
      id: 'card_delete',
      label: 'Delete card',
      description: 'Permanently delete a card.',
      fields: [
        { id: 'boardId', label: 'Board ID', type: 'text', required: true },
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'cardId', label: 'Card ID', type: 'text', required: true },
      ],
      run: cardDelete,
    },
    {
      id: 'card_add_comment',
      label: 'Add comment to card',
      description: 'Post a comment on a card.',
      fields: [
        { id: 'boardId', label: 'Board ID', type: 'text', required: true },
        { id: 'cardId', label: 'Card ID', type: 'text', required: true },
        { id: 'authorId', label: 'Author user ID', type: 'text', required: true },
        { id: 'comment', label: 'Comment', type: 'textarea', required: true },
      ],
      run: cardAddComment,
    },
  ],
};

registerForgeBlock(block);
export default block;
