/**
 * Forge block: Google Contacts (People API)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/Contacts/GoogleContacts.node.ts
 *
 * Auth: OAuth2 refresh-token grant; clientId/clientSecret/refreshToken inline
 *   per action. Access token refreshed per call and cached via _shared/oauth.ts.
 *
 * Operations covered:
 *   - people.list           GET  /v1/people/me/connections
 *   - people.get            GET  /v1/people/{resourceName}
 *   - people.createContact  POST /v1/people:createContact
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import {
  cacheKeyFor,
  getCachedToken,
  refreshAccessToken,
  setCachedToken,
} from '../_shared/oauth';

const SERVICE = 'Google Contacts';
const CACHE = 'google_contacts';

type OAuthCred = { clientId: string; clientSecret: string; refreshToken: string };

function readCred(ctx: ForgeActionContext): OAuthCred {
  const clientId = asString(ctx.options.clientId);
  const clientSecret = asString(ctx.options.clientSecret);
  const refreshToken = asString(ctx.options.refreshToken);
  if (!clientId) throw new Error(`${SERVICE}: clientId is required`);
  if (!clientSecret) throw new Error(`${SERVICE}: clientSecret is required`);
  if (!refreshToken) throw new Error(`${SERVICE}: refreshToken is required`);
  return { clientId, clientSecret, refreshToken };
}

async function getOrRefreshAccessToken(cred: OAuthCred): Promise<string> {
  const key = cacheKeyFor(CACHE, cred.refreshToken);
  const cached = getCachedToken(key);
  if (cached) return cached;
  const { accessToken, expiresIn } = await refreshAccessToken({
    service: SERVICE,
    tokenUrl: 'https://oauth2.googleapis.com/token',
    refreshToken: cred.refreshToken,
    clientId: cred.clientId,
    clientSecret: cred.clientSecret,
  });
  setCachedToken(key, accessToken, expiresIn);
  return accessToken;
}

const authFields = [
  { id: 'clientId', label: 'Client ID', type: 'password' as const, required: true },
  { id: 'clientSecret', label: 'Client secret', type: 'password' as const, required: true },
  { id: 'refreshToken', label: 'Refresh token', type: 'password' as const, required: true },
];

// ── Actions ────────────────────────────────────────────────────────────────

async function peopleList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const params = new URLSearchParams();
  const personFields = asString(ctx.options.personFields) || 'names,emailAddresses,phoneNumbers';
  const pageSize = asString(ctx.options.pageSize);
  const pageToken = asString(ctx.options.pageToken);
  params.set('personFields', personFields);
  if (pageSize) params.set('pageSize', pageSize);
  if (pageToken) params.set('pageToken', pageToken);
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `https://people.googleapis.com/v1/people/me/connections?${params.toString()}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { result: res.data }, logs: ['Contacts people list'] };
}

async function peopleGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const resourceName = asString(ctx.options.resourceName);
  if (!resourceName) throw new Error(`${SERVICE}: resourceName is required (e.g. people/c12345)`);
  const personFields = asString(ctx.options.personFields) || 'names,emailAddresses,phoneNumbers';
  const res = await apiRequest({
    service: SERVICE,
    method: 'GET',
    url: `https://people.googleapis.com/v1/${encodeURI(resourceName)}?personFields=${encodeURIComponent(personFields)}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { result: res.data }, logs: [`Contacts people get → ${resourceName}`] };
}

async function peopleCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const accessToken = await getOrRefreshAccessToken(readCred(ctx));
  const givenName = asString(ctx.options.givenName);
  const familyName = asString(ctx.options.familyName);
  const email = asString(ctx.options.email);
  const phone = asString(ctx.options.phone);
  if (!givenName && !familyName) throw new Error(`${SERVICE}: givenName or familyName is required`);
  const body: Record<string, unknown> = {
    names: [{ givenName, familyName }],
  };
  if (email) body.emailAddresses = [{ value: email }];
  if (phone) body.phoneNumbers = [{ value: phone }];
  const res = await apiRequest({
    service: SERVICE,
    method: 'POST',
    url: 'https://people.googleapis.com/v1/people:createContact',
    headers: { Authorization: `Bearer ${accessToken}` },
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Contacts create → ${givenName} ${familyName}`.trim()] };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_google_contacts',
  name: 'Google Contacts',
  description: 'List, get and create contacts via the Google People API.',
  iconName: 'LuUsers',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'people_list',
      label: 'List contacts',
      description: 'List connections (contacts) for the authenticated user.',
      fields: [
        ...authFields,
        { id: 'personFields', label: 'Person fields mask', type: 'text', defaultValue: 'names,emailAddresses,phoneNumbers' },
        { id: 'pageSize', label: 'Page size', type: 'number' },
        { id: 'pageToken', label: 'Page token', type: 'text' },
      ],
      run: peopleList,
    },
    {
      id: 'people_get',
      label: 'Get contact',
      description: 'Fetch a person resource by name (e.g. `people/c12345`).',
      fields: [
        ...authFields,
        { id: 'resourceName', label: 'Resource name', type: 'text', required: true, placeholder: 'people/c12345' },
        { id: 'personFields', label: 'Person fields mask', type: 'text', defaultValue: 'names,emailAddresses,phoneNumbers' },
      ],
      run: peopleGet,
    },
    {
      id: 'people_create_contact',
      label: 'Create contact',
      description: 'Create a new contact.',
      fields: [
        ...authFields,
        { id: 'givenName', label: 'Given name', type: 'text' },
        { id: 'familyName', label: 'Family name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
      ],
      run: peopleCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
