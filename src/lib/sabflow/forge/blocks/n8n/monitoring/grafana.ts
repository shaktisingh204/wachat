/**
 * Forge block: Grafana
 *
 * Source: n8n-master/packages/nodes-base/nodes/Grafana/Grafana.node.ts
 * Credential type: 'grafana' → { baseUrl, apiKey }.
 *
 * Operations:
 *   - dashboard.list      GET  /api/search?type=dash-db
 *   - dashboard.get       GET  /api/dashboards/uid/{uid}
 *   - dashboard.create    POST /api/dashboards/db
 *   - alert.list          GET  /api/v1/provisioning/alert-rules
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function grafanaAuth(ctx: ForgeActionContext): { base: string; token: string } {
  const cred = requireCredential('Grafana', ctx.credential);
  const base = (cred.baseUrl ?? '').replace(/\/+$/, '');
  const token = cred.apiKey ?? '';
  if (!base) throw new Error('Grafana: credential is missing `baseUrl`');
  if (!token) throw new Error('Grafana: credential is missing `apiKey`');
  return { base, token };
}

async function grafanaRequest(
  ctx: ForgeActionContext,
  method: 'GET' | 'POST',
  path: string,
  json?: unknown,
): Promise<unknown> {
  const { base, token } = grafanaAuth(ctx);
  const res = await apiRequest({
    service: 'Grafana',
    method,
    url: `${base}${path.startsWith('/') ? path : `/${path}`}`,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    json,
  });
  return res.data;
}

async function dashboardList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.query);
  const qs = new URLSearchParams({ type: 'dash-db' });
  if (query) qs.set('query', query);
  const data = await grafanaRequest(ctx, 'GET', `/api/search?${qs.toString()}`);
  return { outputs: { dashboards: data }, logs: ['Grafana dashboard list'] };
}

async function dashboardGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const uid = asString(ctx.options.uid);
  if (!uid) throw new Error('Grafana: dashboard uid is required');
  const data = await grafanaRequest(ctx, 'GET', `/api/dashboards/uid/${uid}`);
  return { outputs: { dashboard: data }, logs: [`Grafana dashboard get → ${uid}`] };
}

async function dashboardCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  const folderId = asString(ctx.options.folderId);
  const dashboardJson = asString(ctx.options.dashboardJson);
  if (!title && !dashboardJson) {
    throw new Error('Grafana: either title or dashboardJson is required');
  }

  let dashboard: Record<string, unknown>;
  if (dashboardJson) {
    try {
      dashboard = JSON.parse(dashboardJson) as Record<string, unknown>;
    } catch {
      throw new Error('Grafana: dashboardJson must be valid JSON');
    }
  } else {
    dashboard = { title, panels: [], schemaVersion: 16, version: 0 };
  }

  const body: Record<string, unknown> = { dashboard, overwrite: false };
  if (folderId) body.folderId = Number(folderId);

  const data = await grafanaRequest(ctx, 'POST', '/api/dashboards/db', body);
  return { outputs: { dashboard: data }, logs: [`Grafana dashboard create → ${title || 'json'}`] };
}

async function alertList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await grafanaRequest(ctx, 'GET', '/api/v1/provisioning/alert-rules');
  return { outputs: { alerts: data }, logs: ['Grafana alert list'] };
}

const block: ForgeBlock = {
  id: 'forge_grafana',
  name: 'Grafana',
  description: 'List, create and inspect Grafana dashboards and alerts.',
  iconName: 'LuChartLine',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'grafana' },
  actions: [
    {
      id: 'dashboard_list',
      label: 'List dashboards',
      fields: [{ id: 'query', label: 'Query', type: 'text' }],
      run: dashboardList,
    },
    {
      id: 'dashboard_get',
      label: 'Get dashboard',
      fields: [{ id: 'uid', label: 'Dashboard UID', type: 'text', required: true }],
      run: dashboardGet,
    },
    {
      id: 'dashboard_create',
      label: 'Create dashboard',
      fields: [
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'folderId', label: 'Folder ID', type: 'number' },
        { id: 'dashboardJson', label: 'Dashboard JSON (overrides title)', type: 'textarea' },
      ],
      run: dashboardCreate,
    },
    {
      id: 'alert_list',
      label: 'List alert rules',
      fields: [],
      run: alertList,
    },
  ],
};

registerForgeBlock(block);
export default block;
