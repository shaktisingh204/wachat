/**
 * Forge block: ServiceNow
 *
 * Source: n8n-master/packages/nodes-base/nodes/ServiceNow/ServiceNow.node.ts
 * Credential type: 'servicenow' (CREDENTIAL_FIELD_SCHEMAS → { instanceUrl, username, password }).
 *
 * Uses Basic auth (n8n offers OAuth too; basic is enough for the first port).
 *
 * Operations covered (incident + table-record subset, REST v2 Table API):
 *   - incident.create   POST   /api/now/v2/table/incident
 *   - incident.get      GET    /api/now/v2/table/incident/{sysId}
 *   - incident.update   PATCH  /api/now/v2/table/incident/{sysId}
 *   - incident.delete   DELETE /api/now/v2/table/incident/{sysId}
 *   - table.list        GET    /api/now/v2/table/{tableName}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

type SnCred = { instanceUrl: string; username: string; password: string };

function getCred(ctx: ForgeActionContext): SnCred {
  const cred = requireCredential('ServiceNow', ctx.credential);
  const instanceUrl = (cred.instanceUrl ?? '').replace(/\/+$/, '');
  const username = cred.username;
  const password = cred.password;
  if (!instanceUrl) throw new Error('ServiceNow: credential is missing `instanceUrl`');
  if (!username || !password) throw new Error('ServiceNow: credential is missing `username` / `password`');
  return { instanceUrl, username, password };
}

function authHeaders(c: SnCred): Record<string, string> {
  const basic = btoa(`${c.username}:${c.password}`);
  return { Authorization: `Basic ${basic}`, Accept: 'application/json' };
}

function buildIncidentBody(opts: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const key of ['short_description', 'description', 'urgency', 'impact', 'priority', 'assigned_to', 'caller_id', 'category', 'state'] as const) {
    const v = asString(opts[key]);
    if (v) body[key] = v;
  }
  return body;
}

async function incidentCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const shortDescription = asString(ctx.options.short_description);
  if (!shortDescription) throw new Error('ServiceNow: short_description is required');
  const body = buildIncidentBody(ctx.options);

  const res = await apiRequest({
    service: 'ServiceNow',
    method: 'POST',
    url: `${c.instanceUrl}/api/now/v2/table/incident`,
    headers: authHeaders(c),
    json: body,
  });
  const data = (res.data as { result?: { sys_id?: string } }).result ?? null;
  return { outputs: { incident: data }, logs: [`ServiceNow incident create → ${data?.sys_id}`] };
}

async function incidentGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const sysId = asString(ctx.options.sysId);
  if (!sysId) throw new Error('ServiceNow: sysId is required');
  const res = await apiRequest({
    service: 'ServiceNow',
    method: 'GET',
    url: `${c.instanceUrl}/api/now/v2/table/incident/${encodeURIComponent(sysId)}`,
    headers: authHeaders(c),
  });
  const data = (res.data as { result?: unknown }).result ?? null;
  return { outputs: { incident: data }, logs: [`ServiceNow incident get → ${sysId}`] };
}

async function incidentUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const sysId = asString(ctx.options.sysId);
  if (!sysId) throw new Error('ServiceNow: sysId is required');
  const body = buildIncidentBody(ctx.options);
  if (Object.keys(body).length === 0) {
    throw new Error('ServiceNow: at least one updatable field must be set');
  }
  const res = await apiRequest({
    service: 'ServiceNow',
    method: 'PATCH',
    url: `${c.instanceUrl}/api/now/v2/table/incident/${encodeURIComponent(sysId)}`,
    headers: authHeaders(c),
    json: body,
  });
  const data = (res.data as { result?: unknown }).result ?? null;
  return { outputs: { incident: data }, logs: [`ServiceNow incident update → ${sysId}`] };
}

async function incidentDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const sysId = asString(ctx.options.sysId);
  if (!sysId) throw new Error('ServiceNow: sysId is required');
  await apiRequest({
    service: 'ServiceNow',
    method: 'DELETE',
    url: `${c.instanceUrl}/api/now/v2/table/incident/${encodeURIComponent(sysId)}`,
    headers: authHeaders(c),
  });
  return { outputs: { success: true }, logs: [`ServiceNow incident delete → ${sysId}`] };
}

async function tableList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const tableName = asString(ctx.options.tableName);
  if (!tableName) throw new Error('ServiceNow: tableName is required');
  const limit = asString(ctx.options.limit);
  const query = asString(ctx.options.query);
  const params = new URLSearchParams();
  if (limit) params.set('sysparm_limit', limit);
  if (query) params.set('sysparm_query', query);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'ServiceNow',
    method: 'GET',
    url: `${c.instanceUrl}/api/now/v2/table/${encodeURIComponent(tableName)}${qs ? `?${qs}` : ''}`,
    headers: authHeaders(c),
  });
  const data = (res.data as { result?: unknown[] }).result ?? [];
  return { outputs: { records: data }, logs: [`ServiceNow ${tableName} list → ${Array.isArray(data) ? data.length : 0}`] };
}

const block: ForgeBlock = {
  id: 'forge_servicenow',
  name: 'ServiceNow',
  description: 'Create, update and query ServiceNow incidents and tables from a flow.',
  iconName: 'LuTicket',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'servicenow' },
  actions: [
    {
      id: 'incident_create',
      label: 'Create incident',
      description: 'Create a new incident record.',
      fields: [
        { id: 'short_description', label: 'Short description', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'urgency', label: 'Urgency (1-3)', type: 'text' },
        { id: 'impact', label: 'Impact (1-3)', type: 'text' },
        { id: 'priority', label: 'Priority', type: 'text' },
        { id: 'caller_id', label: 'Caller (sys_id or user_name)', type: 'text' },
        { id: 'assigned_to', label: 'Assigned to (sys_id or user_name)', type: 'text' },
        { id: 'category', label: 'Category', type: 'text' },
      ],
      run: incidentCreate,
    },
    {
      id: 'incident_get',
      label: 'Get incident',
      description: 'Fetch a single incident by sys_id.',
      fields: [{ id: 'sysId', label: 'sys_id', type: 'text', required: true }],
      run: incidentGet,
    },
    {
      id: 'incident_update',
      label: 'Update incident',
      description: 'Patch an incident. Only set fields are sent.',
      fields: [
        { id: 'sysId', label: 'sys_id', type: 'text', required: true },
        { id: 'short_description', label: 'Short description', type: 'text' },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'urgency', label: 'Urgency (1-3)', type: 'text' },
        { id: 'impact', label: 'Impact (1-3)', type: 'text' },
        { id: 'priority', label: 'Priority', type: 'text' },
        { id: 'state', label: 'State', type: 'text' },
        { id: 'assigned_to', label: 'Assigned to', type: 'text' },
      ],
      run: incidentUpdate,
    },
    {
      id: 'incident_delete',
      label: 'Delete incident',
      description: 'Permanently delete an incident.',
      fields: [{ id: 'sysId', label: 'sys_id', type: 'text', required: true }],
      run: incidentDelete,
    },
    {
      id: 'table_list',
      label: 'List table records',
      description: 'List records from any ServiceNow table.',
      fields: [
        { id: 'tableName', label: 'Table name', type: 'text', required: true, placeholder: 'incident' },
        { id: 'query', label: 'Encoded query (sysparm_query)', type: 'text' },
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: '50' },
      ],
      run: tableList,
    },
  ],
};

registerForgeBlock(block);
export default block;
