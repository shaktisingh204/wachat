/**
 * Forge block: Trello
 *
 * Source: n8n-master/packages/nodes-base/nodes/Trello/Trello.node.ts
 * Credential type: 'trello' (CREDENTIAL_FIELD_SCHEMAS → { apiKey, apiToken }).
 *
 * Operations covered (card + comment subset):
 *   - card.create   POST   /1/cards
 *   - card.get      GET    /1/cards/{id}
 *   - card.update   PUT    /1/cards/{id}
 *   - card.delete   DELETE /1/cards/{id}
 *   - card.addComment  POST /1/cards/{id}/actions/comments
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.trello.com/1';

function authQuery(ctx: ForgeActionContext): URLSearchParams {
  const cred = requireCredential('Trello', ctx.credential);
  const key = cred.apiKey;
  const token = cred.apiToken;
  if (!key || !token) throw new Error('Trello: credential is missing `apiKey` or `apiToken`');
  const p = new URLSearchParams();
  p.set('key', key);
  p.set('token', token);
  return p;
}

async function cardCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const idList = asString(ctx.options.idList);
  const name = asString(ctx.options.name);
  if (!idList) throw new Error('Trello: idList is required');
  if (!name) throw new Error('Trello: name is required');
  const params = authQuery(ctx);
  params.set('idList', idList);
  params.set('name', name);
  const desc = asString(ctx.options.desc);
  if (desc) params.set('desc', desc);
  const due = asString(ctx.options.due);
  if (due) params.set('due', due);

  const res = await apiRequest({
    service: 'Trello',
    method: 'POST',
    url: `${BASE}/cards?${params}`,
  });
  return { outputs: { card: res.data }, logs: [`Trello card create → ${(res.data as { id?: string })?.id ?? '?'}`] };
}

async function cardGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Trello: id is required');
  const res = await apiRequest({
    service: 'Trello',
    method: 'GET',
    url: `${BASE}/cards/${encodeURIComponent(id)}?${authQuery(ctx)}`,
  });
  return { outputs: { card: res.data }, logs: [`Trello card get → ${id}`] };
}

async function cardUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Trello: id is required');
  const params = authQuery(ctx);
  let any = false;
  for (const key of ['name', 'desc', 'idList', 'due', 'closed', 'pos'] as const) {
    const v = asString(ctx.options[key]);
    if (v) {
      params.set(key, v);
      any = true;
    }
  }
  if (!any) throw new Error('Trello: at least one updatable field must be set');

  const res = await apiRequest({
    service: 'Trello',
    method: 'PUT',
    url: `${BASE}/cards/${encodeURIComponent(id)}?${params}`,
  });
  return { outputs: { card: res.data }, logs: [`Trello card update → ${id}`] };
}

async function cardDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Trello: id is required');
  await apiRequest({
    service: 'Trello',
    method: 'DELETE',
    url: `${BASE}/cards/${encodeURIComponent(id)}?${authQuery(ctx)}`,
  });
  return { outputs: { success: true }, logs: [`Trello card delete → ${id}`] };
}

async function cardAddComment(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.id);
  const text = asString(ctx.options.text);
  if (!id) throw new Error('Trello: id is required');
  if (!text) throw new Error('Trello: text is required');
  const params = authQuery(ctx);
  params.set('text', text);
  const res = await apiRequest({
    service: 'Trello',
    method: 'POST',
    url: `${BASE}/cards/${encodeURIComponent(id)}/actions/comments?${params}`,
  });
  return { outputs: { comment: res.data }, logs: [`Trello comment → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_trello',
  name: 'Trello',
  description: 'Create, update and comment on Trello cards from a flow.',
  iconName: 'LuKanban',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'trello' },
  actions: [
    {
      id: 'card_create',
      label: 'Create card',
      description: 'Create a new card in a list.',
      fields: [
        { id: 'idList', label: 'List ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'desc', label: 'Description', type: 'textarea' },
        { id: 'due', label: 'Due date (ISO 8601)', type: 'text' },
      ],
      run: cardCreate,
    },
    {
      id: 'card_get',
      label: 'Get card',
      description: 'Fetch a single card by id.',
      fields: [{ id: 'id', label: 'Card ID', type: 'text', required: true }],
      run: cardGet,
    },
    {
      id: 'card_update',
      label: 'Update card',
      description: 'Patch a card. Only set fields are sent.',
      fields: [
        { id: 'id', label: 'Card ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'desc', label: 'Description', type: 'textarea' },
        { id: 'idList', label: 'Move to list ID', type: 'text' },
        { id: 'due', label: 'Due date (ISO 8601)', type: 'text' },
        { id: 'closed', label: 'Closed (true/false)', type: 'text' },
        { id: 'pos', label: 'Position', type: 'text' },
      ],
      run: cardUpdate,
    },
    {
      id: 'card_delete',
      label: 'Delete card',
      description: 'Permanently delete a card.',
      fields: [{ id: 'id', label: 'Card ID', type: 'text', required: true }],
      run: cardDelete,
    },
    {
      id: 'card_add_comment',
      label: 'Add comment to card',
      description: 'Post a comment on a card.',
      fields: [
        { id: 'id', label: 'Card ID', type: 'text', required: true },
        { id: 'text', label: 'Comment', type: 'textarea', required: true },
      ],
      run: cardAddComment,
    },
  ],
};

registerForgeBlock(block);
export default block;
