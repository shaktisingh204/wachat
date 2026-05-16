/**
 * Forge block: Elastic Security
 *
 * Source: n8n-master/packages/nodes-base/nodes/Elastic/ElasticSecurity/ElasticSecurity.node.ts
 *
 * Basic-auth (username + password) against the Kibana base URL. Cases API
 * lives at `${baseUrl}/api/cases`.
 *
 * Operations covered:
 *   - case.create    POST   /api/cases
 *   - case.get       GET    /api/cases/{id}
 *   - case.update    PATCH  /api/cases
 *   - case.list      GET    /api/cases/_find
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
  if (!raw) throw new Error('Elastic Security: baseUrl is required');
  return raw.replace(/\/+$/, '');
}

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const username = asString(ctx.options.username);
  const password = asString(ctx.options.password);
  if (!username || !password) throw new Error('Elastic Security: username and password are required');
  const token = Buffer.from(`${username}:${password}`).toString('base64');
  return { Authorization: `Basic ${token}`, 'kbn-xsrf': 'true' };
}

async function caseCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  const description = asString(ctx.options.description);
  if (!title) throw new Error('Elastic Security: title is required');
  const body: Record<string, unknown> = {
    title,
    description: description || '',
    tags: [],
    connector: { id: 'none', name: 'none', type: '.none', fields: null },
    settings: { syncAlerts: false },
    owner: asString(ctx.options.owner) || 'securitySolution',
  };
  const res = await apiRequest({
    service: 'Elastic Security',
    method: 'POST',
    url: `${base(ctx)}/api/cases`,
    headers: authHeader(ctx),
    json: body,
  });
  return { outputs: { case: res.data }, logs: [`Elastic Security case.create → ${title}`] };
}

async function caseGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.caseId);
  if (!id) throw new Error('Elastic Security: caseId is required');
  const res = await apiRequest({
    service: 'Elastic Security',
    method: 'GET',
    url: `${base(ctx)}/api/cases/${encodeURIComponent(id)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { case: res.data }, logs: [`Elastic Security case.get → ${id}`] };
}

async function caseUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.caseId);
  const version = asString(ctx.options.version);
  if (!id || !version) throw new Error('Elastic Security: caseId and version are required');
  const cases: Record<string, unknown> = { id, version };
  const title = asString(ctx.options.title);
  const description = asString(ctx.options.description);
  const status = asString(ctx.options.status);
  if (title) cases.title = title;
  if (description) cases.description = description;
  if (status) cases.status = status;
  const res = await apiRequest({
    service: 'Elastic Security',
    method: 'PATCH',
    url: `${base(ctx)}/api/cases`,
    headers: authHeader(ctx),
    json: { cases: [cases] },
  });
  return { outputs: { cases: res.data }, logs: [`Elastic Security case.update → ${id}`] };
}

async function caseList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const params = new URLSearchParams();
  const perPage = asString(ctx.options.perPage);
  const page = asString(ctx.options.page);
  if (perPage) params.set('perPage', perPage);
  if (page) params.set('page', page);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Elastic Security',
    method: 'GET',
    url: `${base(ctx)}/api/cases/_find${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { results: res.data }, logs: ['Elastic Security case.list'] };
}

const credFields = [
  { id: 'baseUrl', label: 'Kibana base URL', type: 'text' as const, required: true, placeholder: 'https://kibana.example.com' },
  { id: 'username', label: 'Username', type: 'text' as const, required: true },
  { id: 'password', label: 'Password', type: 'password' as const, required: true },
];

const block: ForgeBlock = {
  id: 'forge_elastic_security',
  name: 'Elastic Security',
  description: 'Create and manage cases in Elastic Security via the Kibana Cases API.',
  iconName: 'LuShield',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'case_create',
      label: 'Create case',
      description: 'Open a new case in Elastic Security.',
      fields: [
        ...credFields,
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'owner', label: 'Owner', type: 'text', defaultValue: 'securitySolution' },
      ],
      run: caseCreate,
    },
    {
      id: 'case_get',
      label: 'Get case',
      description: 'Fetch a single case by id.',
      fields: [
        ...credFields,
        { id: 'caseId', label: 'Case ID', type: 'text', required: true },
      ],
      run: caseGet,
    },
    {
      id: 'case_update',
      label: 'Update case',
      description: 'Patch an existing case (title/description/status). Requires the current `version` token returned from get.',
      fields: [
        ...credFields,
        { id: 'caseId', label: 'Case ID', type: 'text', required: true },
        { id: 'version', label: 'Version', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'status', label: 'Status', type: 'select', options: [
          { label: 'Open', value: 'open' },
          { label: 'In progress', value: 'in-progress' },
          { label: 'Closed', value: 'closed' },
        ] },
      ],
      run: caseUpdate,
    },
    {
      id: 'case_list',
      label: 'List cases',
      description: 'Search the cases index.',
      fields: [
        ...credFields,
        { id: 'page', label: 'Page', type: 'number' },
        { id: 'perPage', label: 'Per page', type: 'number' },
      ],
      run: caseList,
    },
  ],
};

registerForgeBlock(block);
export default block;
