/**
 * Forge block: TheHive Project (v5 API)
 *
 * Source: n8n-master/packages/nodes-base/nodes/TheHiveProject/TheHiveProject.node.ts
 *
 * TheHive v5 incident-response platform. Uses the modern `/api/v1/...`
 * endpoints (the legacy `forge_thehive` port covers the v3/v4 surface).
 *
 * Credentials are passed inline:
 *   - baseUrl  (e.g. https://thehive.example.com)
 *   - apiKey   (Bearer)
 *
 * Operations covered:
 *   - case_v5_create   POST /api/v1/case
 *   - case_v5_get      GET  /api/v1/case/{id}
 *   - alert_v5_list    POST /api/v1/query (alerts list query)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('TheHive Project: apiKey is required');
  return { Authorization: `Bearer ${apiKey}` };
}

function base(ctx: ForgeActionContext): string {
  const baseUrl = asString(ctx.options.baseUrl).replace(/\/+$/, '');
  if (!baseUrl) throw new Error('TheHive Project: baseUrl is required');
  return baseUrl;
}

function parseJsonObject(raw: unknown, label: string): Record<string, unknown> {
  let value: unknown = raw;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return {};
    try {
      value = JSON.parse(t);
    } catch (err) {
      throw new Error(`TheHive Project: ${label} is not valid JSON — ${(err as Error).message}`);
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`TheHive Project: ${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

async function caseV5Create(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  const description = asString(ctx.options.description);
  const severity = asNumber(ctx.options.severity);
  if (!title) throw new Error('TheHive Project: title is required');
  const extra = ctx.options.extra !== undefined ? parseJsonObject(ctx.options.extra, 'extra') : {};
  const body: Record<string, unknown> = { title, description, ...extra };
  if (severity !== undefined) body.severity = severity;
  const res = await apiRequest({
    service: 'TheHiveProject',
    method: 'POST',
    url: `${base(ctx)}/api/v1/case`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { case: res.data }, logs: ['TheHiveProject case_v5_create'] };
}

async function caseV5Get(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.caseId);
  if (!id) throw new Error('TheHive Project: caseId is required');
  const res = await apiRequest({
    service: 'TheHiveProject',
    method: 'GET',
    url: `${base(ctx)}/api/v1/case/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { case: res.data }, logs: [`TheHiveProject case_v5_get → ${id}`] };
}

async function alertV5List(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const limit = asNumber(ctx.options.limit) ?? 25;
  const query = {
    query: [
      { _name: 'listAlert' },
      { _name: 'page', from: 0, to: limit },
    ],
  };
  const res = await apiRequest({
    service: 'TheHiveProject',
    method: 'POST',
    url: `${base(ctx)}/api/v1/query?name=alerts-list`,
    headers: authHeader(ctx),
    json: query,
  });
  return { outputs: { alerts: res.data }, logs: [`TheHiveProject alert_v5_list → limit=${limit}`] };
}

const COMMON_FIELDS = [
  { id: 'baseUrl', label: 'Base URL', type: 'text' as const, required: true, placeholder: 'https://thehive.example.com' },
  { id: 'apiKey', label: 'API key', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_thehive_project',
  name: 'TheHive Project (v5)',
  description: 'Create and read cases plus list alerts against TheHive v5 (`/api/v1`).',
  iconName: 'LuShieldAlert',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'case_v5_create',
      label: 'Create case',
      description: 'POST /api/v1/case — create a new case.',
      fields: [
        ...COMMON_FIELDS,
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'severity', label: 'Severity (1-4)', type: 'number' },
        {
          id: 'extra',
          label: 'Extra fields',
          type: 'json',
          placeholder: '{"tlp":2,"tags":["phishing"]}',
          helperText: 'Merged onto the body. Useful for tlp, pap, tags, customFields, etc.',
        },
      ],
      run: caseV5Create,
    },
    {
      id: 'case_v5_get',
      label: 'Get case',
      description: 'GET /api/v1/case/{id}.',
      fields: [
        ...COMMON_FIELDS,
        { id: 'caseId', label: 'Case ID', type: 'text', required: true },
      ],
      run: caseV5Get,
    },
    {
      id: 'alert_v5_list',
      label: 'List alerts',
      description: 'POST /api/v1/query — list alerts with a page limit.',
      fields: [
        ...COMMON_FIELDS,
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: 25 },
      ],
      run: alertV5List,
    },
  ],
};

registerForgeBlock(block);
export default block;
