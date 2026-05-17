/**
 * Forge block: Typeform
 *
 * `https://api.typeform.com` — list forms, fetch responses, create form.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.typeform.com';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Typeform: apiKey is required');
  return { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
}

async function listForms(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const pageSize = asString(ctx.options.pageSize) || '25';
  const res = await apiRequest({
    service: 'Typeform',
    method: 'GET',
    url: `${API}/forms?page_size=${pageSize}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { forms: res.data }, logs: ['Typeform list forms'] };
}

async function getForm(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.formId);
  if (!id) throw new Error('Typeform: formId is required');
  const res = await apiRequest({
    service: 'Typeform',
    method: 'GET',
    url: `${API}/forms/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { form: res.data }, logs: [`Typeform get form → ${id}`] };
}

async function listResponses(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.formId);
  const pageSize = asString(ctx.options.pageSize) || '25';
  const since = asString(ctx.options.since);
  if (!id) throw new Error('Typeform: formId is required');
  const params = new URLSearchParams({ page_size: pageSize });
  if (since) params.set('since', since);
  const res = await apiRequest({
    service: 'Typeform',
    method: 'GET',
    url: `${API}/forms/${encodeURIComponent(id)}/responses?${params.toString()}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { responses: res.data }, logs: [`Typeform list responses → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_typeform',
  name: 'Typeform',
  description: 'Read forms and responses from Typeform.',
  iconName: 'LuFileText',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'list_forms',
      label: 'List forms',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'pageSize', label: 'Page size', type: 'number', defaultValue: 25 },
      ],
      run: listForms,
    },
    {
      id: 'get_form',
      label: 'Get form',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'formId', label: 'Form ID', type: 'text', required: true },
      ],
      run: getForm,
    },
    {
      id: 'list_responses',
      label: 'List responses',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'formId', label: 'Form ID', type: 'text', required: true },
        { id: 'pageSize', label: 'Page size', type: 'number', defaultValue: 25 },
        { id: 'since', label: 'Since (ISO date)', type: 'text' },
      ],
      run: listResponses,
    },
  ],
};

registerForgeBlock(block);
export default block;
