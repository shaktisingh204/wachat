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
 *   - contact.get          GET    /crm/sales/api/contacts/{id}
 *   - contact.create       POST   /crm/sales/api/contacts
 *   - contact.update       PUT    /crm/sales/api/contacts/{id}
 *   - contact.delete       DELETE /crm/sales/api/contacts/{id}
 *   - contact.list_view    GET    /crm/sales/api/contacts/view/{view}  (paginated)
 *   - account.get          GET    /crm/sales/api/sales_accounts/{id}
 *   - account.create       POST   /crm/sales/api/sales_accounts
 *   - account.update       PUT    /crm/sales/api/sales_accounts/{id}
 *   - account.delete       DELETE /crm/sales/api/sales_accounts/{id}
 *   - account.list_view    GET    /crm/sales/api/sales_accounts/view/{view}  (paginated)
 *   - deal.get             GET    /crm/sales/api/deals/{id}
 *   - deal.create          POST   /crm/sales/api/deals
 *   - deal.update          PUT    /crm/sales/api/deals/{id}
 *   - deal.delete          DELETE /crm/sales/api/deals/{id}
 *   - deal.list_view       GET    /crm/sales/api/deals/view/{view}  (paginated)
 *   - task.get             GET    /crm/sales/api/tasks/{id}
 *   - task.create          POST   /crm/sales/api/tasks
 *   - task.update          PUT    /crm/sales/api/tasks/{id}
 *   - task.delete          DELETE /crm/sales/api/tasks/{id}
 *   - note.create          POST   /crm/sales/api/notes
 *   - note.update          PUT    /crm/sales/api/notes/{id}
 *   - note.delete          DELETE /crm/sales/api/notes/{id}
 *   - search.query         GET    /crm/sales/api/search
 *   - search.lookup        GET    /crm/sales/api/lookup
 *
 * Out of scope: appointment / sales-activity CRUD (timezone-sensitive date
 * normalisation), LoadOptions for views/territories.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

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

async function contactUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Freshworks CRM: contactId is required');
  const contact: Record<string, unknown> = parseExtra(ctx.options.extra);
  if (asString(ctx.options.firstName)) contact.first_name = asString(ctx.options.firstName);
  if (asString(ctx.options.lastName)) contact.last_name = asString(ctx.options.lastName);
  if (asString(ctx.options.email)) contact.email = asString(ctx.options.email);
  if (asString(ctx.options.mobileNumber)) contact.mobile_number = asString(ctx.options.mobileNumber);
  if (asString(ctx.options.jobTitle)) contact.job_title = asString(ctx.options.jobTitle);
  if (Object.keys(contact).length === 0) {
    throw new Error('Freshworks CRM: at least one updatable field must be provided');
  }
  const data = (await fwApi(ctx, 'PUT', `/contacts/${encodeURIComponent(id)}`, { contact })) as {
    contact?: unknown;
  } | null;
  return { outputs: { contact: data?.contact ?? data, id }, logs: [`Freshworks contact update → ${id}`] };
}

async function contactDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.contactId);
  if (!id) throw new Error('Freshworks CRM: contactId is required');
  await fwApi(ctx, 'DELETE', `/contacts/${encodeURIComponent(id)}`);
  return { outputs: { success: true, id }, logs: [`Freshworks contact delete → ${id}`] };
}

// Shared paginated list helper. Freshworks pagination: `page=1,2,...` with
// `meta.total_pages` indicating when to stop.
async function listView<T>(
  ctx: ForgeActionContext,
  path: string,
  responseKey: string,
  maxItems: number,
): Promise<T[]> {
  const { baseUrl, apiKey } = resolveAuth(ctx);
  return paginateAll<T>({
    maxItems,
    async fetchPage(cursor) {
      const page = cursor ? Number(cursor) : 1;
      const res = await apiRequest({
        service: 'Freshworks CRM',
        method: 'GET',
        url: `${baseUrl}/crm/sales/api${path}?page=${page}`,
        headers: { Authorization: `Token token=${apiKey}` },
      });
      const body = res.data as Record<string, unknown> & {
        meta?: { total_pages?: number };
      };
      const items = ((body?.[responseKey] as T[] | undefined) ?? []) as T[];
      const totalPages = body?.meta?.total_pages ?? 0;
      const more = page < totalPages;
      return { items, nextCursor: more ? String(page + 1) : undefined };
    },
  });
}

async function contactListView(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const view = asString(ctx.options.viewId);
  if (!view) throw new Error('Freshworks CRM: viewId is required (use `0` for all-contacts view)');
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const items = await listView<unknown>(ctx, `/contacts/view/${encodeURIComponent(view)}`, 'contacts', maxItems);
  return { outputs: { contacts: items, count: items.length }, logs: [`Freshworks contact list view → ${items.length}`] };
}

// ── Account ────────────────────────────────────────────────────────────────

async function accountGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.accountId);
  if (!id) throw new Error('Freshworks CRM: accountId is required');
  const data = (await fwApi(ctx, 'GET', `/sales_accounts/${encodeURIComponent(id)}`)) as {
    sales_account?: unknown;
  } | null;
  return { outputs: { account: data?.sales_account ?? data }, logs: [`Freshworks account get → ${id}`] };
}

async function accountUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.accountId);
  if (!id) throw new Error('Freshworks CRM: accountId is required');
  const sales_account: Record<string, unknown> = parseExtra(ctx.options.extra);
  if (asString(ctx.options.name)) sales_account.name = asString(ctx.options.name);
  if (asString(ctx.options.website)) sales_account.website = asString(ctx.options.website);
  if (asString(ctx.options.phone)) sales_account.phone = asString(ctx.options.phone);
  if (Object.keys(sales_account).length === 0) {
    throw new Error('Freshworks CRM: at least one updatable field must be provided');
  }
  const data = (await fwApi(ctx, 'PUT', `/sales_accounts/${encodeURIComponent(id)}`, { sales_account })) as {
    sales_account?: unknown;
  } | null;
  return { outputs: { account: data?.sales_account ?? data, id }, logs: [`Freshworks account update → ${id}`] };
}

async function accountDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.accountId);
  if (!id) throw new Error('Freshworks CRM: accountId is required');
  await fwApi(ctx, 'DELETE', `/sales_accounts/${encodeURIComponent(id)}`);
  return { outputs: { success: true, id }, logs: [`Freshworks account delete → ${id}`] };
}

async function accountListView(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const view = asString(ctx.options.viewId);
  if (!view) throw new Error('Freshworks CRM: viewId is required');
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const items = await listView<unknown>(
    ctx,
    `/sales_accounts/view/${encodeURIComponent(view)}`,
    'sales_accounts',
    maxItems,
  );
  return { outputs: { accounts: items, count: items.length }, logs: [`Freshworks account list view → ${items.length}`] };
}

// ── Deal ───────────────────────────────────────────────────────────────────

async function dealGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.dealId);
  if (!id) throw new Error('Freshworks CRM: dealId is required');
  const data = (await fwApi(ctx, 'GET', `/deals/${encodeURIComponent(id)}`)) as {
    deal?: unknown;
  } | null;
  return { outputs: { deal: data?.deal ?? data }, logs: [`Freshworks deal get → ${id}`] };
}

async function dealUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.dealId);
  if (!id) throw new Error('Freshworks CRM: dealId is required');
  const deal: Record<string, unknown> = parseExtra(ctx.options.extra);
  if (asString(ctx.options.name)) deal.name = asString(ctx.options.name);
  if (asString(ctx.options.amount)) deal.amount = Number(asString(ctx.options.amount));
  if (asString(ctx.options.dealStageId)) deal.deal_stage_id = Number(asString(ctx.options.dealStageId));
  if (asString(ctx.options.salesAccountId)) deal.sales_account_id = Number(asString(ctx.options.salesAccountId));
  if (Object.keys(deal).length === 0) {
    throw new Error('Freshworks CRM: at least one updatable field must be provided');
  }
  const data = (await fwApi(ctx, 'PUT', `/deals/${encodeURIComponent(id)}`, { deal })) as {
    deal?: unknown;
  } | null;
  return { outputs: { deal: data?.deal ?? data, id }, logs: [`Freshworks deal update → ${id}`] };
}

async function dealDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.dealId);
  if (!id) throw new Error('Freshworks CRM: dealId is required');
  await fwApi(ctx, 'DELETE', `/deals/${encodeURIComponent(id)}`);
  return { outputs: { success: true, id }, logs: [`Freshworks deal delete → ${id}`] };
}

async function dealListView(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const view = asString(ctx.options.viewId);
  if (!view) throw new Error('Freshworks CRM: viewId is required');
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const items = await listView<unknown>(ctx, `/deals/view/${encodeURIComponent(view)}`, 'deals', maxItems);
  return { outputs: { deals: items, count: items.length }, logs: [`Freshworks deal list view → ${items.length}`] };
}

// ── Task ───────────────────────────────────────────────────────────────────

async function taskGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.taskId);
  if (!id) throw new Error('Freshworks CRM: taskId is required');
  const data = (await fwApi(ctx, 'GET', `/tasks/${encodeURIComponent(id)}`)) as {
    task?: unknown;
  } | null;
  return { outputs: { task: data?.task ?? data }, logs: [`Freshworks task get → ${id}`] };
}

async function taskUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.taskId);
  if (!id) throw new Error('Freshworks CRM: taskId is required');
  const task: Record<string, unknown> = parseExtra(ctx.options.extra);
  if (asString(ctx.options.title)) task.title = asString(ctx.options.title);
  if (asString(ctx.options.dueDate)) task.due_date = asString(ctx.options.dueDate);
  if (asString(ctx.options.ownerId)) task.owner_id = Number(asString(ctx.options.ownerId));
  if (Object.keys(task).length === 0) {
    throw new Error('Freshworks CRM: at least one updatable field must be provided');
  }
  const data = (await fwApi(ctx, 'PUT', `/tasks/${encodeURIComponent(id)}`, { task })) as {
    task?: unknown;
  } | null;
  return { outputs: { task: data?.task ?? data, id }, logs: [`Freshworks task update → ${id}`] };
}

async function taskDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.taskId);
  if (!id) throw new Error('Freshworks CRM: taskId is required');
  await fwApi(ctx, 'DELETE', `/tasks/${encodeURIComponent(id)}`);
  return { outputs: { success: true, id }, logs: [`Freshworks task delete → ${id}`] };
}

// ── Note ───────────────────────────────────────────────────────────────────

async function noteCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const description = asString(ctx.options.description);
  const targetableId = asString(ctx.options.targetableId);
  const targetableType = asString(ctx.options.targetableType) || 'Contact';
  if (!description) throw new Error('Freshworks CRM: description is required');
  if (!targetableId) throw new Error('Freshworks CRM: targetableId is required');
  const data = (await fwApi(ctx, 'POST', '/notes', {
    description,
    targetable_id: Number(targetableId),
    targetable_type: targetableType,
  })) as { note?: { id?: number } } | null;
  return {
    outputs: { note: data?.note ?? data, id: data?.note?.id ?? null },
    logs: [`Freshworks note create → ${data?.note?.id ?? '?'}`],
  };
}

async function noteUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.noteId);
  if (!id) throw new Error('Freshworks CRM: noteId is required');
  const description = asString(ctx.options.description);
  if (!description) throw new Error('Freshworks CRM: description is required');
  const data = (await fwApi(ctx, 'PUT', `/notes/${encodeURIComponent(id)}`, { description })) as {
    note?: unknown;
  } | null;
  return { outputs: { note: data?.note ?? data, id }, logs: [`Freshworks note update → ${id}`] };
}

async function noteDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.noteId);
  if (!id) throw new Error('Freshworks CRM: noteId is required');
  await fwApi(ctx, 'DELETE', `/notes/${encodeURIComponent(id)}`);
  return { outputs: { success: true, id }, logs: [`Freshworks note delete → ${id}`] };
}

// ── Search ─────────────────────────────────────────────────────────────────

async function searchQuery(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { baseUrl, apiKey } = resolveAuth(ctx);
  const q = asString(ctx.options.query);
  const entities = asString(ctx.options.entities);
  if (!q) throw new Error('Freshworks CRM: query is required');
  if (!entities) throw new Error('Freshworks CRM: entities is required (comma-separated)');
  const qs = new URLSearchParams({ q, include: entities, per_page: '100' });
  const res = await apiRequest({
    service: 'Freshworks CRM',
    method: 'GET',
    url: `${baseUrl}/crm/sales/api/search?${qs.toString()}`,
    headers: { Authorization: `Token token=${apiKey}` },
  });
  return { outputs: { results: res.data }, logs: [`Freshworks search → ${q}`] };
}

async function searchLookup(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { baseUrl, apiKey } = resolveAuth(ctx);
  const searchField = asString(ctx.options.searchField);
  const fieldValue = asString(ctx.options.fieldValue);
  const entities = asString(ctx.options.entities);
  if (!searchField) throw new Error('Freshworks CRM: searchField is required');
  if (!fieldValue) throw new Error('Freshworks CRM: fieldValue is required');
  if (!entities) throw new Error('Freshworks CRM: entities is required');
  const qs = new URLSearchParams({ q: fieldValue, f: searchField, entities });
  const res = await apiRequest({
    service: 'Freshworks CRM',
    method: 'GET',
    url: `${baseUrl}/crm/sales/api/lookup?${qs.toString()}`,
    headers: { Authorization: `Token token=${apiKey}` },
  });
  return { outputs: { results: res.data }, logs: [`Freshworks lookup → ${searchField}=${fieldValue}`] };
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
    {
      id: 'contact_update',
      label: 'Update contact',
      description: 'Patch fields on a contact.',
      fields: [
        { id: 'contactId', label: 'Contact ID', type: 'text', required: true },
        { id: 'firstName', label: 'First name', type: 'text' },
        { id: 'lastName', label: 'Last name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'mobileNumber', label: 'Mobile number', type: 'text' },
        { id: 'jobTitle', label: 'Job title', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: contactUpdate,
    },
    {
      id: 'contact_delete',
      label: 'Delete contact',
      description: 'Permanently delete a contact.',
      fields: [{ id: 'contactId', label: 'Contact ID', type: 'text', required: true }],
      run: contactDelete,
    },
    {
      id: 'contact_list_view',
      label: 'List contacts in view',
      description: 'Walk Freshworks page-based pagination for a contacts view.',
      fields: [
        { id: 'viewId', label: 'View ID', type: 'text', required: true },
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
      ],
      run: contactListView,
    },
    {
      id: 'account_get',
      label: 'Get account',
      description: 'Fetch a sales account by id.',
      fields: [{ id: 'accountId', label: 'Account ID', type: 'text', required: true }],
      run: accountGet,
    },
    {
      id: 'account_update',
      label: 'Update account',
      description: 'Patch fields on a sales account.',
      fields: [
        { id: 'accountId', label: 'Account ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'website', label: 'Website', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: accountUpdate,
    },
    {
      id: 'account_delete',
      label: 'Delete account',
      description: 'Permanently delete a sales account.',
      fields: [{ id: 'accountId', label: 'Account ID', type: 'text', required: true }],
      run: accountDelete,
    },
    {
      id: 'account_list_view',
      label: 'List accounts in view',
      description: 'Walk pagination for a sales-accounts view.',
      fields: [
        { id: 'viewId', label: 'View ID', type: 'text', required: true },
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
      ],
      run: accountListView,
    },
    {
      id: 'deal_get',
      label: 'Get deal',
      description: 'Fetch a deal by id.',
      fields: [{ id: 'dealId', label: 'Deal ID', type: 'text', required: true }],
      run: dealGet,
    },
    {
      id: 'deal_update',
      label: 'Update deal',
      description: 'Patch fields on a deal.',
      fields: [
        { id: 'dealId', label: 'Deal ID', type: 'text', required: true },
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'amount', label: 'Amount', type: 'number' },
        { id: 'dealStageId', label: 'Deal stage ID', type: 'text' },
        { id: 'salesAccountId', label: 'Sales account ID', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: dealUpdate,
    },
    {
      id: 'deal_delete',
      label: 'Delete deal',
      description: 'Permanently delete a deal.',
      fields: [{ id: 'dealId', label: 'Deal ID', type: 'text', required: true }],
      run: dealDelete,
    },
    {
      id: 'deal_list_view',
      label: 'List deals in view',
      description: 'Walk pagination for a deals view.',
      fields: [
        { id: 'viewId', label: 'View ID', type: 'text', required: true },
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
      ],
      run: dealListView,
    },
    {
      id: 'task_get',
      label: 'Get task',
      description: 'Fetch a task by id.',
      fields: [{ id: 'taskId', label: 'Task ID', type: 'text', required: true }],
      run: taskGet,
    },
    {
      id: 'task_update',
      label: 'Update task',
      description: 'Patch fields on a task.',
      fields: [
        { id: 'taskId', label: 'Task ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'dueDate', label: 'Due date (ISO 8601)', type: 'text' },
        { id: 'ownerId', label: 'Owner ID', type: 'text' },
        { id: 'extra', label: 'Extra fields (JSON)', type: 'json' },
      ],
      run: taskUpdate,
    },
    {
      id: 'task_delete',
      label: 'Delete task',
      description: 'Permanently delete a task.',
      fields: [{ id: 'taskId', label: 'Task ID', type: 'text', required: true }],
      run: taskDelete,
    },
    {
      id: 'note_create',
      label: 'Create note',
      description: 'Attach a note to a contact, deal or sales account.',
      fields: [
        { id: 'description', label: 'Description', type: 'textarea', required: true },
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
      ],
      run: noteCreate,
    },
    {
      id: 'note_update',
      label: 'Update note',
      description: 'Replace a note\'s description.',
      fields: [
        { id: 'noteId', label: 'Note ID', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea', required: true },
      ],
      run: noteUpdate,
    },
    {
      id: 'note_delete',
      label: 'Delete note',
      description: 'Permanently delete a note.',
      fields: [{ id: 'noteId', label: 'Note ID', type: 'text', required: true }],
      run: noteDelete,
    },
    {
      id: 'search_query',
      label: 'Search',
      description: 'Full-text search across one or more entity types.',
      fields: [
        { id: 'query', label: 'Query', type: 'text', required: true },
        {
          id: 'entities',
          label: 'Entities (comma-separated)',
          type: 'text',
          required: true,
          placeholder: 'contact,deal,sales_account',
        },
      ],
      run: searchQuery,
    },
    {
      id: 'search_lookup',
      label: 'Lookup search',
      description: 'Lookup entities by an exact field value.',
      fields: [
        { id: 'searchField', label: 'Search field', type: 'text', required: true, placeholder: 'email | phone' },
        { id: 'fieldValue', label: 'Field value', type: 'text', required: true },
        {
          id: 'entities',
          label: 'Entities (comma-separated)',
          type: 'text',
          required: true,
          placeholder: 'contact,deal',
        },
      ],
      run: searchLookup,
    },
  ],
};

registerForgeBlock(block);
export default block;
