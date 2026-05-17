/**
 * Forge block: Tally
 *
 * `https://api.tally.so` — list forms and fetch responses.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.tally.so';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Tally: apiKey is required');
  return { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
}

async function listForms(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Tally',
    method: 'GET',
    url: `${API}/forms`,
    headers: authHeaders(ctx),
  });
  return { outputs: { forms: res.data }, logs: ['Tally list forms'] };
}

async function getForm(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const formId = asString(ctx.options.formId);
  if (!formId) throw new Error('Tally: formId is required');
  const res = await apiRequest({
    service: 'Tally',
    method: 'GET',
    url: `${API}/forms/${encodeURIComponent(formId)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { form: res.data }, logs: [`Tally get form → ${formId}`] };
}

async function listResponses(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const formId = asString(ctx.options.formId);
  if (!formId) throw new Error('Tally: formId is required');
  const res = await apiRequest({
    service: 'Tally',
    method: 'GET',
    url: `${API}/forms/${encodeURIComponent(formId)}/submissions`,
    headers: authHeaders(ctx),
  });
  return { outputs: { responses: res.data }, logs: [`Tally list responses → ${formId}`] };
}

const block: ForgeBlock = {
  id: 'forge_tally',
  name: 'Tally',
  description: 'Read Tally forms and submissions.',
  iconName: 'LuFileText',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'list_forms',
      label: 'List forms',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
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
      ],
      run: listResponses,
    },
  ],
};

registerForgeBlock(block);
export default block;
