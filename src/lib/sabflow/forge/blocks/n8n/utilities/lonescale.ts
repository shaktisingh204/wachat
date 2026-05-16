/**
 * Forge block: LoneScale
 *
 * Source: n8n-master/packages/nodes-base/nodes/LoneScale/LoneScale.node.ts
 *
 * Auth: `X-API-KEY: <apiKey>`.
 *
 * Operations covered:
 *   - list.create       POST /lists
 *   - list.list         GET  /lists?entity={entity}
 *   - item.add_person   POST /lists/{listId}/item  (entity=PEOPLE)
 *   - item.add_company  POST /lists/{listId}/item  (entity=COMPANY)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://public-api.lonescale.com';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('LoneScale: apiKey is required');
  return { 'X-API-KEY': apiKey, Accept: 'application/json' };
}

async function listCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  const entity = asString(ctx.options.entity);
  if (!name) throw new Error('LoneScale: name is required');
  if (entity !== 'PEOPLE' && entity !== 'COMPANY') {
    throw new Error('LoneScale: entity must be PEOPLE or COMPANY');
  }
  const res = await apiRequest({
    service: 'LoneScale',
    method: 'POST',
    url: `${API}/lists`,
    headers: authHeaders(ctx),
    json: { name, entity },
  });
  return { outputs: { list: res.data }, logs: [`LoneScale list create → ${name} (${entity})`] };
}

async function listList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const entity = asString(ctx.options.entity);
  const params = new URLSearchParams();
  if (entity) params.set('entity', entity);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'LoneScale',
    method: 'GET',
    url: `${API}/lists${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { lists: res.data }, logs: ['LoneScale list list'] };
}

async function itemAddPerson(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const listId = asString(ctx.options.listId);
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  if (!listId) throw new Error('LoneScale: listId is required');
  if (!firstName) throw new Error('LoneScale: firstName is required');
  if (!lastName) throw new Error('LoneScale: lastName is required');
  const body: Record<string, unknown> = { first_name: firstName, last_name: lastName };
  const fullName = asString(ctx.options.fullName);
  const email = asString(ctx.options.email);
  const currentPosition = asString(ctx.options.currentPosition);
  const linkedinUrl = asString(ctx.options.linkedinUrl);
  const companyName = asString(ctx.options.companyName);
  const domain = asString(ctx.options.domain);
  const location = asString(ctx.options.location);
  const contactId = asString(ctx.options.contactId);
  if (fullName) body.full_name = fullName;
  if (email) body.email = email;
  if (currentPosition) body.current_position = currentPosition;
  if (linkedinUrl) body.linkedin_url = linkedinUrl;
  if (companyName) body.company_name = companyName;
  if (domain) body.domain = domain;
  if (location) body.location = location;
  if (contactId) body.contact_id = contactId;
  const res = await apiRequest({
    service: 'LoneScale',
    method: 'POST',
    url: `${API}/lists/${encodeURIComponent(listId)}/item`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { item: res.data }, logs: [`LoneScale item add person → ${firstName} ${lastName}`] };
}

async function itemAddCompany(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const listId = asString(ctx.options.listId);
  const companyName = asString(ctx.options.companyName);
  if (!listId) throw new Error('LoneScale: listId is required');
  if (!companyName) throw new Error('LoneScale: companyName is required');
  const body: Record<string, unknown> = { company_name: companyName };
  const linkedinUrl = asString(ctx.options.linkedinUrl);
  const domain = asString(ctx.options.domain);
  const location = asString(ctx.options.location);
  const contactId = asString(ctx.options.contactId);
  if (linkedinUrl) body.linkedin_url = linkedinUrl;
  if (domain) body.domain = domain;
  if (location) body.location = location;
  if (contactId) body.contact_id = contactId;
  const res = await apiRequest({
    service: 'LoneScale',
    method: 'POST',
    url: `${API}/lists/${encodeURIComponent(listId)}/item`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { item: res.data }, logs: [`LoneScale item add company → ${companyName}`] };
}

const ENTITY_OPTIONS = [
  { label: 'People', value: 'PEOPLE' },
  { label: 'Company', value: 'COMPANY' },
];

const block: ForgeBlock = {
  id: 'forge_lonescale',
  name: 'LoneScale',
  description: 'Manage LoneScale lists and add people or company items.',
  iconName: 'LuList',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'list_create',
      label: 'Create list',
      description: 'Create a new list of people or companies.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'name', label: 'List name', type: 'text', required: true },
        { id: 'entity', label: 'Entity type', type: 'select', options: ENTITY_OPTIONS, defaultValue: 'PEOPLE', required: true },
      ],
      run: listCreate,
    },
    {
      id: 'list_list',
      label: 'List lists',
      description: 'List existing lists, optionally filtered by entity.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'entity', label: 'Entity filter', type: 'select', options: ENTITY_OPTIONS },
      ],
      run: listList,
    },
    {
      id: 'item_add_person',
      label: 'Add person to list',
      description: 'Add a contact to a list.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text', required: true },
        { id: 'lastName', label: 'Last name', type: 'text', required: true },
        { id: 'fullName', label: 'Full name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'currentPosition', label: 'Current position', type: 'text' },
        { id: 'linkedinUrl', label: 'LinkedIn URL', type: 'text' },
        { id: 'companyName', label: 'Company name', type: 'text' },
        { id: 'domain', label: 'Company domain', type: 'text' },
        { id: 'location', label: 'Location', type: 'text' },
        { id: 'contactId', label: 'External contact ID', type: 'text' },
      ],
      run: itemAddPerson,
    },
    {
      id: 'item_add_company',
      label: 'Add company to list',
      description: 'Add a company to a list.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'listId', label: 'List ID', type: 'text', required: true },
        { id: 'companyName', label: 'Company name', type: 'text', required: true },
        { id: 'linkedinUrl', label: 'LinkedIn URL', type: 'text' },
        { id: 'domain', label: 'Company domain', type: 'text' },
        { id: 'location', label: 'Location', type: 'text' },
        { id: 'contactId', label: 'External contact ID', type: 'text' },
      ],
      run: itemAddCompany,
    },
  ],
};

registerForgeBlock(block);
export default block;
