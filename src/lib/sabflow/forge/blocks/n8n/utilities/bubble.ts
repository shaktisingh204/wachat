/**
 * Forge block: Bubble (Data API)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Bubble/Bubble.node.ts
 *
 * Auth: `Authorization: Bearer <apiToken>` against the Bubble app Data API.
 *
 * Supports both Bubble-hosted (https://{appName}.bubbleapps.io) and
 * self-hosted (custom domain) apps, plus development vs live environments.
 *
 * Operations covered:
 *   - object.create     POST   /obj/{type}
 *   - object.get        GET    /obj/{type}/{id}
 *   - object.update     PATCH  /obj/{type}/{id}
 *   - object.delete     DELETE /obj/{type}/{id}
 *   - object.list       GET    /obj/{type}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function buildBase(ctx: ForgeActionContext): string {
  const hosting = asString(ctx.options.hosting) || 'bubbleHosted';
  const environment = asString(ctx.options.environment) || 'live';
  const appName = asString(ctx.options.appName);
  const domain = asString(ctx.options.domain);
  let rootUrl: string;
  if (hosting === 'selfHosted') {
    if (!domain) throw new Error('Bubble: domain is required for self-hosted apps');
    rootUrl = domain.startsWith('http') ? domain : `https://${domain}`;
  } else {
    if (!appName) throw new Error('Bubble: appName is required for Bubble-hosted apps');
    rootUrl = `https://${appName}.bubbleapps.io`;
  }
  const urlSegment = environment === 'development' ? '/version-test/api/1.1' : '/api/1.1';
  return `${rootUrl.replace(/\/$/, '')}${urlSegment}`;
}

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiToken = asString(ctx.options.apiToken);
  if (!apiToken) throw new Error('Bubble: apiToken is required');
  return {
    Authorization: `Bearer ${apiToken}`,
    'user-agent': 'sabflow',
    Accept: 'application/json',
  };
}

function normaliseTypeName(raw: string): string {
  return raw.replace(/\s/g, '').toLowerCase();
}

function parseProperties(raw: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    throw new Error('Bubble: properties must be a JSON object');
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Bubble:')) throw e;
    throw new Error('Bubble: properties must be valid JSON');
  }
}

async function objectCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const typeName = normaliseTypeName(asString(ctx.options.typeName));
  if (!typeName) throw new Error('Bubble: typeName is required');
  const body = parseProperties(asString(ctx.options.properties));
  const res = await apiRequest({
    service: 'Bubble',
    method: 'POST',
    url: `${buildBase(ctx)}/obj/${encodeURIComponent(typeName)}`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { result: res.data }, logs: [`Bubble object create → ${typeName}`] };
}

async function objectGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const typeName = normaliseTypeName(asString(ctx.options.typeName));
  const objectId = asString(ctx.options.objectId);
  if (!typeName) throw new Error('Bubble: typeName is required');
  if (!objectId) throw new Error('Bubble: objectId is required');
  const res = await apiRequest({
    service: 'Bubble',
    method: 'GET',
    url: `${buildBase(ctx)}/obj/${encodeURIComponent(typeName)}/${encodeURIComponent(objectId)}`,
    headers: authHeaders(ctx),
  });
  const data = res.data as { response?: unknown } | unknown;
  return {
    outputs: { object: (data as { response?: unknown })?.response ?? data },
    logs: [`Bubble object get → ${typeName}/${objectId}`],
  };
}

async function objectUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const typeName = normaliseTypeName(asString(ctx.options.typeName));
  const objectId = asString(ctx.options.objectId);
  if (!typeName) throw new Error('Bubble: typeName is required');
  if (!objectId) throw new Error('Bubble: objectId is required');
  const body = parseProperties(asString(ctx.options.properties));
  await apiRequest({
    service: 'Bubble',
    method: 'PATCH',
    url: `${buildBase(ctx)}/obj/${encodeURIComponent(typeName)}/${encodeURIComponent(objectId)}`,
    headers: authHeaders(ctx),
    json: body,
  });
  return { outputs: { success: true }, logs: [`Bubble object update → ${typeName}/${objectId}`] };
}

async function objectDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const typeName = normaliseTypeName(asString(ctx.options.typeName));
  const objectId = asString(ctx.options.objectId);
  if (!typeName) throw new Error('Bubble: typeName is required');
  if (!objectId) throw new Error('Bubble: objectId is required');
  await apiRequest({
    service: 'Bubble',
    method: 'DELETE',
    url: `${buildBase(ctx)}/obj/${encodeURIComponent(typeName)}/${encodeURIComponent(objectId)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { success: true }, logs: [`Bubble object delete → ${typeName}/${objectId}`] };
}

async function objectList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const typeName = normaliseTypeName(asString(ctx.options.typeName));
  if (!typeName) throw new Error('Bubble: typeName is required');
  const params = new URLSearchParams();
  const limit = asString(ctx.options.limit);
  const cursor = asString(ctx.options.cursor);
  const constraintsRaw = asString(ctx.options.constraints);
  if (limit) params.set('limit', limit);
  if (cursor) params.set('cursor', cursor);
  if (constraintsRaw) {
    // Validate JSON ahead of time.
    try {
      JSON.parse(constraintsRaw);
    } catch {
      throw new Error('Bubble: constraints must be valid JSON');
    }
    params.set('constraints', constraintsRaw);
  }
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Bubble',
    method: 'GET',
    url: `${buildBase(ctx)}/obj/${encodeURIComponent(typeName)}${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  const data = res.data as { response?: { results?: unknown } } | unknown;
  return {
    outputs: { results: (data as { response?: { results?: unknown } })?.response?.results ?? data },
    logs: [`Bubble object list → ${typeName}`],
  };
}

const HOSTING_OPTIONS = [
  { label: 'Bubble-hosted', value: 'bubbleHosted' },
  { label: 'Self-hosted', value: 'selfHosted' },
];

const ENVIRONMENT_OPTIONS = [
  { label: 'Live', value: 'live' },
  { label: 'Development', value: 'development' },
];

const CREDENTIAL_FIELDS = [
  { id: 'apiToken', label: 'API token', type: 'password' as const, required: true },
  { id: 'hosting', label: 'Hosting', type: 'select' as const, options: HOSTING_OPTIONS, defaultValue: 'bubbleHosted' },
  { id: 'appName', label: 'App name (Bubble-hosted)', type: 'text' as const, placeholder: 'myapp' },
  { id: 'domain', label: 'Domain (self-hosted)', type: 'text' as const, placeholder: 'https://mydomain.com' },
  { id: 'environment', label: 'Environment', type: 'select' as const, options: ENVIRONMENT_OPTIONS, defaultValue: 'live' },
];

const block: ForgeBlock = {
  id: 'forge_bubble',
  name: 'Bubble',
  description: 'Read and write Bubble app data via the Data API.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'object_create',
      label: 'Create object',
      description: 'Create a record of the given data type.',
      fields: [
        ...CREDENTIAL_FIELDS,
        { id: 'typeName', label: 'Type name', type: 'text', required: true, placeholder: 'task' },
        { id: 'properties', label: 'Properties (JSON object)', type: 'textarea', placeholder: '{"name":"value"}' },
      ],
      run: objectCreate,
    },
    {
      id: 'object_get',
      label: 'Get object',
      description: 'Fetch a single record by id.',
      fields: [
        ...CREDENTIAL_FIELDS,
        { id: 'typeName', label: 'Type name', type: 'text', required: true },
        { id: 'objectId', label: 'Object ID', type: 'text', required: true },
      ],
      run: objectGet,
    },
    {
      id: 'object_update',
      label: 'Update object',
      description: 'Patch a record with new property values.',
      fields: [
        ...CREDENTIAL_FIELDS,
        { id: 'typeName', label: 'Type name', type: 'text', required: true },
        { id: 'objectId', label: 'Object ID', type: 'text', required: true },
        { id: 'properties', label: 'Properties (JSON object)', type: 'textarea', placeholder: '{"name":"value"}' },
      ],
      run: objectUpdate,
    },
    {
      id: 'object_delete',
      label: 'Delete object',
      description: 'Delete a record by id.',
      fields: [
        ...CREDENTIAL_FIELDS,
        { id: 'typeName', label: 'Type name', type: 'text', required: true },
        { id: 'objectId', label: 'Object ID', type: 'text', required: true },
      ],
      run: objectDelete,
    },
    {
      id: 'object_list',
      label: 'List objects',
      description: 'List records of a data type with optional constraints.',
      fields: [
        ...CREDENTIAL_FIELDS,
        { id: 'typeName', label: 'Type name', type: 'text', required: true },
        { id: 'limit', label: 'Limit', type: 'number' },
        { id: 'cursor', label: 'Cursor', type: 'number' },
        { id: 'constraints', label: 'Constraints (JSON array)', type: 'textarea', placeholder: '[{"key":"name","constraint_type":"equals","value":"foo"}]' },
      ],
      run: objectList,
    },
  ],
};

registerForgeBlock(block);
export default block;
