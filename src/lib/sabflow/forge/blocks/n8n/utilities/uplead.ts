/**
 * Forge block: UpLead
 *
 * Source: n8n-master/packages/nodes-base/nodes/Uplead/Uplead.node.ts
 * Auth: `Authorization: <apiKey>` header — apiKey inline as `password`.
 *
 * Operations covered:
 *   - search.email          GET /email-search
 *   - search.email-finder   GET /email-finder
 *   - person.lookup         GET /person-lookup (alias of email-finder by domain)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.uplead.com/v2';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('UpLead: apiKey is required');
  return { Authorization: apiKey };
}

async function searchEmail(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const domain = asString(ctx.options.domain);
  if (!domain) throw new Error('UpLead: domain is required');
  const params = new URLSearchParams({ domain });
  const res = await apiRequest({
    service: 'UpLead',
    method: 'GET',
    url: `${API}/email-search?${params.toString()}`,
    headers: authHeader(ctx),
  });
  return { outputs: { results: res.data }, logs: [`UpLead email-search → ${domain}`] };
}

async function emailFinder(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  const domain = asString(ctx.options.domain);
  if (!firstName) throw new Error('UpLead: firstName is required');
  if (!lastName) throw new Error('UpLead: lastName is required');
  if (!domain) throw new Error('UpLead: domain is required');
  const params = new URLSearchParams({ first_name: firstName, last_name: lastName, domain });
  const res = await apiRequest({
    service: 'UpLead',
    method: 'GET',
    url: `${API}/email-finder?${params.toString()}`,
    headers: authHeader(ctx),
  });
  return { outputs: { person: res.data }, logs: [`UpLead email-finder → ${firstName} ${lastName}@${domain}`] };
}

async function personLookup(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = asString(ctx.options.email);
  if (!email) throw new Error('UpLead: email is required');
  const params = new URLSearchParams({ email });
  const res = await apiRequest({
    service: 'UpLead',
    method: 'GET',
    url: `${API}/person-lookup?${params.toString()}`,
    headers: authHeader(ctx),
  });
  return { outputs: { person: res.data }, logs: [`UpLead person-lookup → ${email}`] };
}

const block: ForgeBlock = {
  id: 'forge_uplead',
  name: 'UpLead',
  description: 'Search business contacts and verify emails with UpLead.',
  iconName: 'LuMailSearch',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'search_email',
      label: 'Search emails by domain',
      description: 'List contacts associated with a company domain.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'domain', label: 'Domain', type: 'text', required: true, placeholder: 'acme.com' },
      ],
      run: searchEmail,
    },
    {
      id: 'email_finder',
      label: 'Find email',
      description: 'Find an email given a person name and domain.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'firstName', label: 'First name', type: 'text', required: true },
        { id: 'lastName', label: 'Last name', type: 'text', required: true },
        { id: 'domain', label: 'Domain', type: 'text', required: true, placeholder: 'acme.com' },
      ],
      run: emailFinder,
    },
    {
      id: 'person_lookup',
      label: 'Person lookup',
      description: 'Look up a person by their email address.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'email', label: 'Email', type: 'text', required: true },
      ],
      run: personLookup,
    },
  ],
};

registerForgeBlock(block);
export default block;
