/**
 * Forge block: PagerDuty
 *
 * Source: n8n-master/packages/nodes-base/nodes/PagerDuty/PagerDuty.node.ts
 * Credential type: 'pagerduty' → { apiToken }.
 *
 * Operations:
 *   - incident.create    POST   /incidents
 *   - incident.get       GET    /incidents/{id}
 *   - incident.list      GET    /incidents
 *   - incident.update    PUT    /incidents/{id}
 *   - service.list       GET    /services
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const BASE = 'https://api.pagerduty.com';

function pdHeaders(ctx: ForgeActionContext, from?: string): Record<string, string> {
  const cred = requireCredential('PagerDuty', ctx.credential);
  const token = cred.apiToken ?? cred.apiKey ?? '';
  if (!token) throw new Error('PagerDuty: credential is missing `apiToken`');
  const headers: Record<string, string> = {
    Authorization: `Token token=${token}`,
    Accept: 'application/vnd.pagerduty+json;version=2',
  };
  if (from) headers.From = from;
  return headers;
}

async function incidentCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  const serviceId = asString(ctx.options.serviceId);
  const from = asString(ctx.options.from);
  if (!title) throw new Error('PagerDuty: title is required');
  if (!serviceId) throw new Error('PagerDuty: serviceId is required');
  if (!from) throw new Error('PagerDuty: from (user email) is required');

  const body: Record<string, unknown> = {
    incident: {
      type: 'incident',
      title,
      service: { id: serviceId, type: 'service_reference' },
    },
  };
  const urgency = asString(ctx.options.urgency);
  const details = asString(ctx.options.details);
  if (urgency) (body.incident as Record<string, unknown>).urgency = urgency;
  if (details) {
    (body.incident as Record<string, unknown>).body = {
      type: 'incident_body',
      details,
    };
  }

  const res = await apiRequest({
    service: 'PagerDuty',
    method: 'POST',
    url: `${BASE}/incidents`,
    headers: pdHeaders(ctx, from),
    json: body,
  });
  return { outputs: { incident: (res.data as { incident?: unknown }).incident }, logs: [`PagerDuty incident create → ${title}`] };
}

async function incidentGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.incidentId);
  if (!id) throw new Error('PagerDuty: incidentId is required');
  const res = await apiRequest({
    service: 'PagerDuty',
    method: 'GET',
    url: `${BASE}/incidents/${id}`,
    headers: pdHeaders(ctx),
  });
  return { outputs: { incident: (res.data as { incident?: unknown }).incident }, logs: [`PagerDuty incident get → ${id}`] };
}

async function incidentList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const statuses = asString(ctx.options.statuses);
  const limit = asString(ctx.options.limit);
  if (statuses) {
    for (const s of statuses.split(',').map((x) => x.trim()).filter(Boolean)) {
      params.append('statuses[]', s);
    }
  }
  if (limit) params.set('limit', limit);

  const qs = params.toString();
  const res = await apiRequest({
    service: 'PagerDuty',
    method: 'GET',
    url: `${BASE}/incidents${qs ? `?${qs}` : ''}`,
    headers: pdHeaders(ctx),
  });
  return { outputs: { incidents: (res.data as { incidents?: unknown }).incidents }, logs: ['PagerDuty incident list'] };
}

async function incidentUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.incidentId);
  const from = asString(ctx.options.from);
  if (!id) throw new Error('PagerDuty: incidentId is required');
  if (!from) throw new Error('PagerDuty: from (user email) is required');

  const incident: Record<string, unknown> = { type: 'incident_reference' };
  const status = asString(ctx.options.status);
  const title = asString(ctx.options.title);
  const urgency = asString(ctx.options.urgency);
  if (status) incident.status = status;
  if (title) incident.title = title;
  if (urgency) incident.urgency = urgency;
  if (Object.keys(incident).length === 1) {
    throw new Error('PagerDuty: at least one updatable field must be set');
  }

  const res = await apiRequest({
    service: 'PagerDuty',
    method: 'PUT',
    url: `${BASE}/incidents/${id}`,
    headers: pdHeaders(ctx, from),
    json: { incident },
  });
  return { outputs: { incident: (res.data as { incident?: unknown }).incident }, logs: [`PagerDuty incident update → ${id}`] };
}

async function serviceList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'PagerDuty',
    method: 'GET',
    url: `${BASE}/services`,
    headers: pdHeaders(ctx),
  });
  return { outputs: { services: (res.data as { services?: unknown }).services }, logs: ['PagerDuty service list'] };
}

const block: ForgeBlock = {
  id: 'forge_pagerduty',
  name: 'PagerDuty',
  description: 'Create and manage PagerDuty incidents from a flow.',
  iconName: 'LuSiren',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'pagerduty' },
  actions: [
    {
      id: 'incident_create',
      label: 'Create incident',
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'serviceId', label: 'Service ID', type: 'text', required: true },
        { id: 'from', label: 'From (user email)', type: 'text', required: true },
        {
          id: 'urgency',
          label: 'Urgency',
          type: 'select',
          options: [
            { label: 'High', value: 'high' },
            { label: 'Low', value: 'low' },
          ],
        },
        { id: 'details', label: 'Details', type: 'textarea' },
      ],
      run: incidentCreate,
    },
    {
      id: 'incident_get',
      label: 'Get incident',
      fields: [{ id: 'incidentId', label: 'Incident ID', type: 'text', required: true }],
      run: incidentGet,
    },
    {
      id: 'incident_list',
      label: 'List incidents',
      fields: [
        { id: 'statuses', label: 'Statuses (comma-separated)', type: 'text', placeholder: 'triggered,acknowledged' },
        { id: 'limit', label: 'Limit', type: 'number', placeholder: '25' },
      ],
      run: incidentList,
    },
    {
      id: 'incident_update',
      label: 'Update incident',
      fields: [
        { id: 'incidentId', label: 'Incident ID', type: 'text', required: true },
        { id: 'from', label: 'From (user email)', type: 'text', required: true },
        {
          id: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { label: 'Unchanged', value: '' },
            { label: 'Acknowledged', value: 'acknowledged' },
            { label: 'Resolved', value: 'resolved' },
          ],
        },
        { id: 'title', label: 'Title', type: 'text' },
        {
          id: 'urgency',
          label: 'Urgency',
          type: 'select',
          options: [
            { label: 'Unchanged', value: '' },
            { label: 'High', value: 'high' },
            { label: 'Low', value: 'low' },
          ],
        },
      ],
      run: incidentUpdate,
    },
    {
      id: 'service_list',
      label: 'List services',
      fields: [],
      run: serviceList,
    },
  ],
};

registerForgeBlock(block);
export default block;
