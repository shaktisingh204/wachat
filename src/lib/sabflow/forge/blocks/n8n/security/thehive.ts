/**
 * Forge block: TheHive
 *
 * Source: n8n-master/packages/nodes-base/nodes/TheHive/TheHive.node.ts
 *
 * TheHive 4/5 — bearer API key against the configured base URL.
 *
 * Operations covered:
 *   - case.create     POST   /api/v1/case
 *   - case.get        GET    /api/v1/case/{id}
 *   - case.list       POST   /api/v1/query (loosely: case index)
 *   - alert.create    POST   /api/v1/alert
 *   - alert.promote   POST   /api/v1/alert/{id}/case
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function base(ctx: ForgeActionContext): string {
  const raw = asString(ctx.options.baseUrl);
  if (!raw) throw new Error('TheHive: baseUrl is required');
  return raw.replace(/\/+$/, '');
}

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.apiKey);
  if (!key) throw new Error('TheHive: apiKey is required');
  return { Authorization: `Bearer ${key}` };
}

async function caseCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  const description = asString(ctx.options.description);
  if (!title || !description) throw new Error('TheHive: title and description are required');
  const body: Record<string, unknown> = { title, description };
  const severity = asString(ctx.options.severity);
  const tlp = asString(ctx.options.tlp);
  const tags = asString(ctx.options.tags);
  if (severity) body.severity = Number(severity);
  if (tlp) body.tlp = Number(tlp);
  if (tags) body.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
  const res = await apiRequest({
    service: 'TheHive',
    method: 'POST',
    url: `${base(ctx)}/api/v1/case`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { case: res.data }, logs: [`TheHive case.create → ${title}`] };
}

async function caseGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.caseId);
  if (!id) throw new Error('TheHive: caseId is required');
  const res = await apiRequest({
    service: 'TheHive',
    method: 'GET',
    url: `${base(ctx)}/api/v1/case/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { case: res.data }, logs: [`TheHive case.get → ${id}`] };
}

async function caseList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'TheHive',
    method: 'POST',
    url: `${base(ctx)}/api/v1/query`,
    headers: authHeader(ctx),
    json: { query: [{ _name: 'listCase' }] },
  });
  return { outputs: { cases: res.data }, logs: ['TheHive case.list'] };
}

async function alertCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  const description = asString(ctx.options.description);
  const type = asString(ctx.options.type);
  const source = asString(ctx.options.source);
  const sourceRef = asString(ctx.options.sourceRef);
  if (!title || !description || !type || !source || !sourceRef) {
    throw new Error('TheHive: title, description, type, source, sourceRef are required');
  }
  const body: Record<string, unknown> = { title, description, type, source, sourceRef };
  const severity = asString(ctx.options.severity);
  if (severity) body.severity = Number(severity);
  const res = await apiRequest({
    service: 'TheHive',
    method: 'POST',
    url: `${base(ctx)}/api/v1/alert`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { alert: res.data }, logs: [`TheHive alert.create → ${title}`] };
}

async function alertPromote(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.alertId);
  if (!id) throw new Error('TheHive: alertId is required');
  const res = await apiRequest({
    service: 'TheHive',
    method: 'POST',
    url: `${base(ctx)}/api/v1/alert/${encodeURIComponent(id)}/case`,
    headers: authHeader(ctx),
    json: {},
  });
  return { outputs: { case: res.data }, logs: [`TheHive alert.promote → ${id}`] };
}

const credFields = [
  { id: 'baseUrl', label: 'Base URL', type: 'text' as const, required: true, placeholder: 'https://thehive.example.com' },
  { id: 'apiKey', label: 'API key', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_thehive',
  name: 'TheHive',
  description: 'Open cases, ingest alerts and promote them in TheHive.',
  iconName: 'LuShield',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'case_create',
      label: 'Create case',
      description: 'Open a new investigation case.',
      fields: [
        ...credFields,
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea', required: true },
        { id: 'severity', label: 'Severity (1-4)', type: 'number' },
        { id: 'tlp', label: 'TLP (0-3)', type: 'number' },
        { id: 'tags', label: 'Tags (comma-separated)', type: 'text' },
      ],
      run: caseCreate,
    },
    {
      id: 'case_get',
      label: 'Get case',
      description: 'Fetch a case by id.',
      fields: [
        ...credFields,
        { id: 'caseId', label: 'Case ID', type: 'text', required: true },
      ],
      run: caseGet,
    },
    {
      id: 'case_list',
      label: 'List cases',
      description: 'List all cases visible to the API key.',
      fields: [...credFields],
      run: caseList,
    },
    {
      id: 'alert_create',
      label: 'Create alert',
      description: 'Ingest a new alert into TheHive.',
      fields: [
        ...credFields,
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea', required: true },
        { id: 'type', label: 'Type', type: 'text', required: true },
        { id: 'source', label: 'Source', type: 'text', required: true },
        { id: 'sourceRef', label: 'Source ref', type: 'text', required: true },
        { id: 'severity', label: 'Severity (1-4)', type: 'number' },
      ],
      run: alertCreate,
    },
    {
      id: 'alert_promote',
      label: 'Promote alert to case',
      description: 'Promote an existing alert into a TheHive case.',
      fields: [
        ...credFields,
        { id: 'alertId', label: 'Alert ID', type: 'text', required: true },
      ],
      run: alertPromote,
    },
  ],
};

registerForgeBlock(block);
export default block;
