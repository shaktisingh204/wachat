/**
 * Forge block: Microsoft Dynamics CRM
 *
 * Source: n8n-master/packages/nodes-base/nodes/Microsoft/Dynamics/MicrosoftDynamicsCrm.node.ts
 * Credential type: 'microsoft_dynamics_crm' — fields: { baseUrl, accessToken }
 *
 * Operations (subset):
 *   - account.list        GET    /api/data/v9.2/accounts
 *   - account.get         GET    /api/data/v9.2/accounts({id})
 *   - account.create      POST   /api/data/v9.2/accounts
 *   - contact.create      POST   /api/data/v9.2/contacts
 *
 * Deferred: update, delete, $select projections, lookup expansion.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function getAuth(ctx: ForgeActionContext): { base: string; headers: Record<string, string> } {
  const cred = requireCredential('Microsoft Dynamics CRM', ctx.credential);
  const baseUrl = cred.baseUrl;
  const token = cred.accessToken;
  if (!baseUrl) throw new Error('Microsoft Dynamics CRM: credential is missing `baseUrl` field');
  if (!token) throw new Error('Microsoft Dynamics CRM: credential is missing `accessToken` field');
  return {
    base: baseUrl.replace(/\/+$/, ''),
    headers: {
      Authorization: `Bearer ${token}`,
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Accept: 'application/json',
      Prefer: 'return=representation',
    },
  };
}

async function dynamicsApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { base, headers } = getAuth(ctx);
  const res = await apiRequest({
    service: 'Microsoft Dynamics CRM',
    method,
    url: `${base}${path}`,
    headers,
    json,
  });
  return res.data;
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error('Microsoft Dynamics CRM: extra fields must be a JSON object');
}

// ── Account actions ────────────────────────────────────────────────────────

async function accountList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const top = asString(ctx.options.top) || '50';
  const filter = asString(ctx.options.filter);
  const qs = new URLSearchParams({ $top: top });
  if (filter) qs.set('$filter', filter);
  const data = await dynamicsApi(
    ctx,
    'GET',
    `/api/data/v9.2/accounts?${qs.toString()}`,
  );
  return { outputs: { result: data }, logs: ['Dynamics account list'] };
}

async function accountGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.accountId);
  if (!id) throw new Error('Microsoft Dynamics CRM: accountId is required');
  const data = await dynamicsApi(ctx, 'GET', `/api/data/v9.2/accounts(${encodeURIComponent(id)})`);
  return { outputs: { account: data }, logs: [`Dynamics account get → ${id}`] };
}

async function accountCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Microsoft Dynamics CRM: name is required');
  const body: Record<string, unknown> = { name, ...parseJsonObject(ctx.options.extra) };
  const email = asString(ctx.options.email);
  const phone = asString(ctx.options.phone);
  if (email) body.emailaddress1 = email;
  if (phone) body.telephone1 = phone;

  const data = (await dynamicsApi(ctx, 'POST', '/api/data/v9.2/accounts', body)) as
    | { accountid?: string }
    | null;
  return {
    outputs: { account: data, id: data?.accountid ?? null },
    logs: [`Dynamics account create → ${data?.accountid ?? '?'}`],
  };
}

// ── Contact actions ────────────────────────────────────────────────────────

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  const email = asString(ctx.options.email);
  if (!firstName && !lastName && !email) {
    throw new Error('Microsoft Dynamics CRM: provide firstName, lastName or email');
  }
  const body: Record<string, unknown> = { ...parseJsonObject(ctx.options.extra) };
  if (firstName) body.firstname = firstName;
  if (lastName) body.lastname = lastName;
  if (email) body.emailaddress1 = email;

  const data = (await dynamicsApi(ctx, 'POST', '/api/data/v9.2/contacts', body)) as
    | { contactid?: string }
    | null;
  return {
    outputs: { contact: data, id: data?.contactid ?? null },
    logs: [`Dynamics contact create → ${data?.contactid ?? '?'}`],
  };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_microsoft_dynamics_crm',
  name: 'Microsoft Dynamics CRM',
  description: 'Manage Dynamics 365 accounts and contacts via the OData Web API.',
  iconName: 'LuBuilding2',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'microsoft_dynamics_crm' },
  actions: [
    {
      id: 'account_list',
      label: 'List accounts',
      fields: [
        { id: 'top', label: 'Top (page size)', type: 'number', defaultValue: 50 },
        { id: 'filter', label: 'OData $filter', type: 'text' },
      ],
      run: accountList,
    },
    {
      id: 'account_get',
      label: 'Get account',
      fields: [{ id: 'accountId', label: 'Account ID (GUID)', type: 'text', required: true }],
      run: accountGet,
    },
    {
      id: 'account_create',
      label: 'Create account',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: accountCreate,
    },
    {
      id: 'contact_create',
      label: 'Create contact',
      fields: [
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: contactCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
