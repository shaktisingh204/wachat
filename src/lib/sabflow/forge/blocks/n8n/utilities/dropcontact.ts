/**
 * Forge block: Dropcontact
 *
 * Source: n8n-master/packages/nodes-base/nodes/Dropcontact/Dropcontact.node.ts
 *
 * Auth: `X-Access-Token: <apiKey>`.
 *
 * Operations covered:
 *   - contact.enrich        POST  /batch  (single-contact batch)
 *   - contact.fetchRequest  GET   /batch/{requestId}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.dropcontact.io';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Dropcontact: apiKey is required');
  return {
    'X-Access-Token': apiKey,
    'user-agent': 'sabflow',
    Accept: 'application/json',
  };
}

async function contactEnrich(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  const company = asString(ctx.options.company);
  const website = asString(ctx.options.website);
  const linkedin = asString(ctx.options.linkedin);
  const language = asString(ctx.options.language) || 'en';
  const sirenRaw = asString(ctx.options.siren).toLowerCase();
  const siren = sirenRaw === 'true' || sirenRaw === '1' || sirenRaw === 'yes';

  if (!email && !firstName && !lastName && !company && !website && !linkedin) {
    throw new Error('Dropcontact: at least one of email/firstName/lastName/company/website/linkedin is required');
  }

  const contact: Record<string, unknown> = {};
  if (email) contact.email = email;
  if (firstName) contact.first_name = firstName;
  if (lastName) contact.last_name = lastName;
  if (company) contact.company = company;
  if (website) contact.website = website;
  if (linkedin) contact.linkedin = linkedin;

  const res = await apiRequest({
    service: 'Dropcontact',
    method: 'POST',
    url: `${API}/batch`,
    headers: authHeader(ctx),
    json: { data: [contact], siren, language },
  });
  return { outputs: { result: res.data }, logs: ['Dropcontact contact enrich'] };
}

async function contactFetchRequest(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const requestId = asString(ctx.options.requestId);
  if (!requestId) throw new Error('Dropcontact: requestId is required');
  const res = await apiRequest({
    service: 'Dropcontact',
    method: 'GET',
    url: `${API}/batch/${encodeURIComponent(requestId)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { result: res.data }, logs: [`Dropcontact fetchRequest → ${requestId}`] };
}

const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'en' },
  { label: 'French', value: 'fr' },
];

const block: ForgeBlock = {
  id: 'forge_dropcontact',
  name: 'Dropcontact',
  description: 'Find B2B emails and enrich contacts via Dropcontact.',
  iconName: 'LuContact',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'contact_enrich',
      label: 'Enrich contact',
      description: 'Find B2B emails and enrich a contact.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'company', label: 'Company', type: 'text' },
        { id: 'website', label: 'Website', type: 'text' },
        { id: 'linkedin', label: 'LinkedIn profile', type: 'text' },
        { id: 'language', label: 'Language', type: 'select', options: LANGUAGE_OPTIONS, defaultValue: 'en' },
        { id: 'siren', label: 'French company enrich (SIREN)', type: 'toggle' },
      ],
      run: contactEnrich,
    },
    {
      id: 'contact_fetch_request',
      label: 'Fetch enrich result',
      description: 'Fetch the result of a previous enrich batch.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'requestId', label: 'Request ID', type: 'text', required: true },
      ],
      run: contactFetchRequest,
    },
  ],
};

registerForgeBlock(block);
export default block;
