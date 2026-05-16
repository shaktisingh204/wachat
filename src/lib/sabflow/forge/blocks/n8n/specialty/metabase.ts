/**
 * Forge block: Metabase
 *
 * Source: n8n-master/packages/nodes-base/nodes/Metabase/Metabase.node.ts
 *
 * Metabase uses session-based auth: exchange username + password for an
 * `X-Metabase-Session` token via `POST /api/session`, then send that token on
 * subsequent requests. We do the exchange inline on every action so creds
 * stay request-scoped.
 *
 * Operations covered:
 *   - card.list                GET   /api/card
 *   - card.get                 GET   /api/card/{id}
 *   - query.execute            POST  /api/card/{id}/query
 *   - dashboard.list           GET   /api/dashboard
 *   - database.list            GET   /api/database
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const url = asString(ctx.options.baseUrl).trim();
  if (!url) throw new Error('Metabase: baseUrl is required');
  return url.replace(/\/$/, '');
}

async function login(ctx: ForgeActionContext): Promise<string> {
  const username = asString(ctx.options.username);
  const password = asString(ctx.options.password);
  if (!username) throw new Error('Metabase: username is required');
  if (!password) throw new Error('Metabase: password is required');
  const res = await apiRequest({
    service: 'Metabase',
    method: 'POST',
    url: `${baseUrl(ctx)}/api/session`,
    json: { username, password },
  });
  const data = res.data as { id?: string } | undefined;
  if (!data?.id) throw new Error('Metabase: session response missing id');
  return data.id;
}

function sessionHeader(token: string): Record<string, string> {
  return { 'X-Metabase-Session': token };
}

async function cardList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = await login(ctx);
  const res = await apiRequest({
    service: 'Metabase',
    method: 'GET',
    url: `${baseUrl(ctx)}/api/card`,
    headers: sessionHeader(token),
  });
  return { outputs: { cards: res.data }, logs: ['Metabase card list'] };
}

async function cardGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.cardId);
  if (!id) throw new Error('Metabase: cardId is required');
  const token = await login(ctx);
  const res = await apiRequest({
    service: 'Metabase',
    method: 'GET',
    url: `${baseUrl(ctx)}/api/card/${encodeURIComponent(id)}`,
    headers: sessionHeader(token),
  });
  return { outputs: { card: res.data }, logs: [`Metabase card get → ${id}`] };
}

async function queryExecute(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.cardId);
  if (!id) throw new Error('Metabase: cardId is required');
  const parametersRaw = ctx.options.parameters;
  let parameters: unknown[] = [];
  if (typeof parametersRaw === 'string' && parametersRaw.trim().length > 0) {
    try {
      const parsed = JSON.parse(parametersRaw);
      parameters = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      throw new Error('Metabase: parameters must be valid JSON');
    }
  } else if (Array.isArray(parametersRaw)) {
    parameters = parametersRaw;
  }
  const token = await login(ctx);
  const res = await apiRequest({
    service: 'Metabase',
    method: 'POST',
    url: `${baseUrl(ctx)}/api/card/${encodeURIComponent(id)}/query`,
    headers: sessionHeader(token),
    json: { parameters },
  });
  return { outputs: { result: res.data }, logs: [`Metabase query execute → ${id}`] };
}

async function dashboardList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = await login(ctx);
  const res = await apiRequest({
    service: 'Metabase',
    method: 'GET',
    url: `${baseUrl(ctx)}/api/dashboard`,
    headers: sessionHeader(token),
  });
  return { outputs: { dashboards: res.data }, logs: ['Metabase dashboard list'] };
}

async function databaseList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = await login(ctx);
  const res = await apiRequest({
    service: 'Metabase',
    method: 'GET',
    url: `${baseUrl(ctx)}/api/database`,
    headers: sessionHeader(token),
  });
  return { outputs: { databases: res.data }, logs: ['Metabase database list'] };
}

const CRED_FIELDS = [
  {
    id: 'baseUrl',
    label: 'Base URL',
    type: 'text' as const,
    required: true,
    placeholder: 'https://metabase.example.com',
  },
  { id: 'username', label: 'Username', type: 'text' as const, required: true },
  { id: 'password', label: 'Password', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_metabase',
  name: 'Metabase',
  description: 'Run Metabase questions and inspect cards, dashboards and databases.',
  iconName: 'LuChartBar',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'card_list',
      label: 'List cards',
      description: 'Fetch every card (saved question).',
      fields: [...CRED_FIELDS],
      run: cardList,
    },
    {
      id: 'card_get',
      label: 'Get card',
      description: 'Fetch a single card by id.',
      fields: [
        ...CRED_FIELDS,
        { id: 'cardId', label: 'Card ID', type: 'text', required: true },
      ],
      run: cardGet,
    },
    {
      id: 'query_execute',
      label: 'Execute card query',
      description: 'Run the query attached to a card with optional parameters.',
      fields: [
        ...CRED_FIELDS,
        { id: 'cardId', label: 'Card ID', type: 'text', required: true },
        {
          id: 'parameters',
          label: 'Parameters',
          type: 'json',
          placeholder: '[{"type": "category", "value": "Foo"}]',
        },
      ],
      run: queryExecute,
    },
    {
      id: 'dashboard_list',
      label: 'List dashboards',
      description: 'Fetch every dashboard.',
      fields: [...CRED_FIELDS],
      run: dashboardList,
    },
    {
      id: 'database_list',
      label: 'List databases',
      description: 'Fetch every connected database.',
      fields: [...CRED_FIELDS],
      run: databaseList,
    },
  ],
};

registerForgeBlock(block);
export default block;
