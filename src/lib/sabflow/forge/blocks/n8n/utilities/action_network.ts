/**
 * Forge block: Action Network
 *
 * Source: n8n-master/packages/nodes-base/nodes/ActionNetwork/ActionNetwork.node.ts
 *
 * Auth: `OSDI-API-Token: <apiKey>` against https://actionnetwork.org/api/v2.
 *
 * Operations covered:
 *   - person.upsert     POST   /people
 *   - person.get        GET    /people/{id}
 *   - event.create      POST   /events
 *   - event.list        GET    /events
 *   - tag.list          GET    /tags
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://actionnetwork.org/api/v2';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Action Network: apiKey is required');
  return { 'OSDI-API-Token': apiKey, Accept: 'application/json' };
}

async function personUpsert(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('Action Network: email is required');
  const person: Record<string, unknown> = {
    email_addresses: [{ address: email, primary: true }],
  };
  const givenName = asString(ctx.options.givenName);
  const familyName = asString(ctx.options.familyName);
  const phone = asString(ctx.options.phone);
  const languagesSpoken = asString(ctx.options.languagesSpoken);
  if (givenName) person.given_name = givenName;
  if (familyName) person.family_name = familyName;
  if (phone) person.phone_numbers = [{ number: phone, primary: true }];
  if (languagesSpoken) person.languages_spoken = [languagesSpoken];
  const res = await apiRequest({
    service: 'Action Network',
    method: 'POST',
    url: `${API}/people`,
    headers: authHeaders(ctx),
    json: { person },
  });
  return { outputs: { person: res.data }, logs: [`Action Network person upsert → ${email}`] };
}

async function personGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.personId);
  if (!id) throw new Error('Action Network: personId is required');
  const res = await apiRequest({
    service: 'Action Network',
    method: 'GET',
    url: `${API}/people/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { person: res.data }, logs: [`Action Network person get → ${id}`] };
}

async function eventCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const originSystem = asString(ctx.options.originSystem);
  const title = asString(ctx.options.title);
  if (!originSystem) throw new Error('Action Network: originSystem is required');
  if (!title) throw new Error('Action Network: title is required');
  const body: Record<string, unknown> = { origin_system: originSystem, title };
  const description = asString(ctx.options.description);
  const startDate = asString(ctx.options.startDate);
  const browserUrl = asString(ctx.options.browserUrl);
  if (description) body.description = description;
  if (startDate) body.start_date = startDate;
  if (browserUrl) body.browser_url = browserUrl;
  const res = await apiRequest({
    service: 'Action Network',
    method: 'POST',
    url: `${API}/events`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { event: res.data }, logs: [`Action Network event create → ${title}`] };
}

async function eventList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const perPage = asString(ctx.options.perPage);
  const page = asString(ctx.options.page);
  if (perPage) params.set('per_page', perPage);
  if (page) params.set('page', page);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Action Network',
    method: 'GET',
    url: `${API}/events${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { events: res.data }, logs: ['Action Network event list'] };
}

async function tagList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const perPage = asString(ctx.options.perPage);
  const page = asString(ctx.options.page);
  if (perPage) params.set('per_page', perPage);
  if (page) params.set('page', page);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Action Network',
    method: 'GET',
    url: `${API}/tags${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { tags: res.data }, logs: ['Action Network tag list'] };
}

const block: ForgeBlock = {
  id: 'forge_action_network',
  name: 'Action Network',
  description: 'Manage Action Network people, events and tags.',
  iconName: 'LuMegaphone',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'person_upsert',
      label: 'Upsert person',
      description: 'Create or update a person by email.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
        { id: 'givenName', label: 'First name', type: 'text' },
        { id: 'familyName', label: 'Last name', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'languagesSpoken', label: 'Language (ISO 639-1)', type: 'text' },
      ],
      run: personUpsert,
    },
    {
      id: 'person_get',
      label: 'Get person',
      description: 'Fetch a person by id.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'personId', label: 'Person ID', type: 'text', required: true },
      ],
      run: personGet,
    },
    {
      id: 'event_create',
      label: 'Create event',
      description: 'Create a new event.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'originSystem', label: 'Origin system', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'startDate', label: 'Start date (ISO 8601)', type: 'text' },
        { id: 'browserUrl', label: 'Browser URL', type: 'text' },
      ],
      run: eventCreate,
    },
    {
      id: 'event_list',
      label: 'List events',
      description: 'List events with pagination.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'perPage', label: 'Per page (max 25)', type: 'number' },
        { id: 'page', label: 'Page', type: 'number' },
      ],
      run: eventList,
    },
    {
      id: 'tag_list',
      label: 'List tags',
      description: 'List tags with pagination.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'perPage', label: 'Per page (max 25)', type: 'number' },
        { id: 'page', label: 'Page', type: 'number' },
      ],
      run: tagList,
    },
  ],
};

registerForgeBlock(block);
export default block;
