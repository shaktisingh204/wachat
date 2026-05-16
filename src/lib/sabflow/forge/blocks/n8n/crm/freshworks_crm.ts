/**
 * Forge block: Freshworks CRM
 *
 * Source: n8n-master/packages/nodes-base/nodes/FreshworksCrm/FreshworksCrm.node.ts
 *   (+ GenericFunctions.ts, descriptions/*)
 * Credential type: 'freshworks_crm' — fields: { baseUrl, apiKey }
 *   baseUrl is the full domain URL (e.g. https://you.myfreshworks.com).
 *   Auth header: `Authorization: Token token=<apiKey>`.
 *
 * Operations covered:
 *   - contact.get        GET    /crm/sales/api/contacts/{id}
 *   - contact.create     POST   /crm/sales/api/contacts
 *   - account.create     POST   /crm/sales/api/sales_accounts
 *   - deal.create        POST   /crm/sales/api/deals
 *   - task.create        POST   /crm/sales/api/tasks
 *
 * Out of scope: notes, appointments, search/LoadOptions for territories.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function resolveAuth(ctx: ForgeActionContext): { baseUrl: string; apiKey: string } {
  const cred = requireCredential('Freshworks CRM', ctx.credential);
  const baseUrl = (cred.baseUrl || '').replace(/\/+$/, '');
  const apiKey = cred.apiKey || '';
  if (!baseUrl) throw new Error('Freshworks CRM: credential is missing `baseUrl`');
  if (!apiKey) throw new Error('Freshworks CRM: credential is missing `apiKey`');
  return { baseUrl, apiKey };
}

async function fwApi(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { baseUrl, apiKey } = resolveAuth(ctx);
  const res = await apiRequest({
    service: 'Freshworks CRM',
    method,
    url: `${baseUrl}/crm/sales/api${path}`,
    headers: { Authorization: `Token token=${apiKey}` },
    json,
  });
  return res.data;
}

function parseExtra(raw: unknown): Record<string, unknown> {
  const s = asString(raw).trim();
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  throw new Error('Freshworks CRM: extra fields must be a JSON object');
}

// ── Contact ────────────────────────────────────────────────────────────────

async function contactGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Freshworks CRM: contactId is required');
  const data = await fwApi(ctx, 'GET', `/contacts/${encodeURIComponent(id)}`);
  return { outputs: { contact: data }, logs: [`Freshworks contact get → ${id}`] };
}

async function contactCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const firstName = asString(ctx.options.firstName);
  const lastName = asString(ctx.options.lastName);
  if (!firstName) throw new Error('Freshworks CRM: firstName is required');
  if (!lastName) throw new Error('Freshworks CRM: lastName is required');
  const contact: Record<string, unknown> = {
    first_name: firstName,
    last_name: lastName,
    ...parseExtra(ctx.options.extra),
  };
  if (asString(ctx.options.email)) contact.email = asString(ctx.options.email);
  if (asString(ctx.options.mobileNumber)) contact.mobile_number = asString(ctx.options.mobileNumber);
  if (asString(ctx.options.jobTitle)) contact.job_title = asString(ctx.options.jobTitle);

  const data = (await fwApi(ctx, 'POST', '/contacts', { contact })) as {
    contact?: { id?: number };
  } | null;
  return {
    outputs: { contact: data?.contact ?? data, id: data?.contact?.id ?? null },
    logs: [`Freshworks contact create → ${data?.contact?.id ?? '?'}`],
  };
}

// ── Account ────────────────────────────────────────────────────────────────

async function accountCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Freshworks CRM: name is required');
  const sales_account: Record<string, unknown> = { name, ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.website)) sales_account.website = asString(ctx.options.website);
  if (asString(ctx.options.phone)) sales_account.phone = asString(ctx.options.phone);

  const data = (await fwApi(ctx, 'POST', '/sales_accounts', { sales_account })) as {
    sales_account?: { id?: number };
  } | null;
  return {
    outputs: { account: data?.sales_account ?? data, id: data?.sales_account?.id ?? null },
    logs: [`Freshworks account create → ${data?.sales_account?.id ?? '?'}`],
  };
}

// ── Deal ───────────────────────────────────────────────────────────────────

async function dealCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name);
  if (!name) throw new Error('Freshworks CRM: name is required');
  const deal: Record<string, unknown> = { name, ...parseExtra(ctx.options.extra) };
  if (asString(ctx.options.amount)) deal.amount = Number(asString(ctx.options.amount));
  if (asString(ctx.options.dealStageId)) deal.deal_stage_id = Number(asString(ctx.options.dealStageId));
  if (asString(ctx.options.salesAccountId)) deal.sales_account_id = Number(asString(ctx.options.salesAccountId));

  const data = (await fwApi(ctx, 'POST', '/deals', { deal })) as { deal?: { id?: number } } | null;
  return {
    outputs: { deal: data?.deal ?? data, id: data?.deal?.id ?? null },
    logs: [`Freshworks deal create → ${data?.deal?.id ?? '?'}`],
  };
}

// ── Task ───────────────────────────────────────────────────────────────────

async function taskCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  const dueDate = asString(ctx.options.dueDate);
  const targetableId = asString(ctx.options.targetableId);
  const targetableType = asString(ctx.options.targetableType) || 'Contact';
  if (!title) throw new Error('Freshworks CRM: title is required');
  if (!dueDate) throw new Error('Freshworks CRM: dueDate is required (ISO 8601)');
  if (!targetableId) throw new Error('Freshworks CRM: targetableId is required');
  const task: Record<string, unknown> = {
    title,
    due_date: dueDate,
    targetable_id: Number(targetableId),
    targetable_type: targetableType,
    ...parseExtra(ctx.options.extra),
  };
  if (asString(ctx.options.ownerId)) task.owner_id = Number(asString(ctx.options.ownerId));

  const data = (await fwApi(ctx, 'POST', '/tasks', { task })) as { task?: { id?: number } } | null;
  return {
    outputs: { task: data?.task ?? data, id: data?.task?.id ?? null },
    logs: [`Freshworks task create → ${data?.task?.id ?? '?'}`],
  };
}

// ── Block ──────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_freshworks_crm',
  name: 'Freshworks CRM',
  description: 'Manage Freshworks CRM contacts, accounts, deals and tasks.',
  iconName: 'LuUsers',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'freshworks_crm' },
  actions: [
    {
      id: 'contact_get',
      label: 'Get contact',
      description: 'Fetch a contact by id.',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }],
      run: contactGet,
    },
    {
      id: 'contact_create',
      label: 'Create contact',
      description: 'Create a new contact.',
      fields: [
        { id: 'firstName', label: 'First name', type: 'text', required: true },
        { id: 'lastName', label: 'Last name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'mobileNumber', label: 'Mobile number', type: 'text' },
        { id: 'jobTitle', label: 'Job title', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: contactCreate,
    },
    {
      id: 'account_create',
      label: 'Create account',
      description: 'Create a new sales account.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'website', label: 'Website', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: accountCreate,
    },
    {
      id: 'deal_create',
      label: 'Create deal',
      description: 'Create a new deal.',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'amount', label: 'Amount', type: 'number' },
        { id: 'dealStageId', label: 'Deal stage ID', type: 'text' },
        { id: 'salesAccountId', label: 'Sales account ID', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: dealCreate,
    },
    {
      id: 'task_create',
      label: 'Create task',
      description: 'Create a task on a targetable record.',
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'dueDate', label: 'Due date (ISO 8601)', type: 'text', required: true },
        { id: 'targetableId', label: 'Targetable ID', type: 'text', required: true },
        {
          id: 'targetableType',
          label: 'Targetable type',
          type: 'select',
          defaultValue: 'Contact',
          options: [
            { label: 'Contact', value: 'Contact' },
            { label: 'Sales Account', value: 'SalesAccount' },
            { label: 'Deal', value: 'Deal' },
          ],
        },
        { id: 'ownerId', label: 'Owner ID', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: taskCreate,
    },
  ],
};

registerForgeBlock(block);
export default block;
