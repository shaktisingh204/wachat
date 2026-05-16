/**
 * Forge block: Google Firebase Realtime Database
 *
 * Source: n8n-master/packages/nodes-base/nodes/Google/Firebase/RealtimeDatabase/GoogleFirebaseRealtimeDatabase.node.ts
 *
 * Auth: OAuth2 refresh-token grant; clientId/clientSecret/refreshToken inline.
 *
 * REST base: https://{projectId}.{region}/{path}.json
 *   - region defaults to `firebaseio.com` (US); supply other regions like
 *     `europe-west1.firebasedatabase.app` if needed.
 *
 * Operations:
 *   - read   GET    {path}.json
 *   - write  PUT    {path}.json
 *   - push   POST   {path}.json
 *   - delete DELETE {path}.json
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';
import { getOrRefreshAccessToken, GOOGLE_TOKEN_URL } from '../_shared/google_oauth';

const SERVICE = 'Firebase Realtime DB';

function readCred(ctx: ForgeActionContext): Record<string, string> {
  const clientId = asString(ctx.options.clientId);
  const clientSecret = asString(ctx.options.clientSecret);
  const refreshToken = asString(ctx.options.refreshToken);
  if (!clientId) throw new Error(`${SERVICE}: clientId is required`);
  if (!clientSecret) throw new Error(`${SERVICE}: clientSecret is required`);
  if (!refreshToken) throw new Error(`${SERVICE}: refreshToken is required`);
  return { clientId, clientSecret, refreshToken };
}

function buildUrl(ctx: ForgeActionContext): string {
  const projectId = asString(ctx.options.projectId);
  const region = asString(ctx.options.region) || 'firebaseio.com';
  let path = asString(ctx.options.path);
  if (!projectId) throw new Error(`${SERVICE}: projectId is required`);
  if (!path) throw new Error(`${SERVICE}: path is required`);
  path = path.replace(/^\/+/, '');
  return `https://${projectId}.${region}/${path}.json`;
}

async function callRtdb(
  ctx: ForgeActionContext,
  method: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE',
  json?: unknown,
): Promise<unknown> {
  const token = await getOrRefreshAccessToken(SERVICE, readCred(ctx), GOOGLE_TOKEN_URL);
  const url = buildUrl(ctx);
  const res = await apiRequest({
    service: SERVICE,
    method,
    url: `${url}?access_token=${encodeURIComponent(token)}`,
    json,
  });
  return res.data;
}

function parseBody(ctx: ForgeActionContext): unknown {
  const raw = asString(ctx.options.value).trim();
  if (!raw) throw new Error(`${SERVICE}: value is required`);
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

const authFields = [
  { id: 'clientId', label: 'Client ID', type: 'password' as const, required: true },
  { id: 'clientSecret', label: 'Client secret', type: 'password' as const, required: true },
  { id: 'refreshToken', label: 'Refresh token', type: 'password' as const, required: true },
];

const targetFields = [
  { id: 'projectId', label: 'Project ID', type: 'text' as const, required: true },
  { id: 'region', label: 'Region host', type: 'text' as const, placeholder: 'firebaseio.com' },
  { id: 'path', label: 'Path', type: 'text' as const, required: true, placeholder: 'users/abc' },
];

async function rtdbRead(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await callRtdb(ctx, 'GET');
  return { outputs: { result: data }, logs: ['RTDB read'] };
}

async function rtdbWrite(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await callRtdb(ctx, 'PUT', parseBody(ctx));
  return { outputs: { result: data }, logs: ['RTDB write (PUT)'] };
}

async function rtdbPush(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await callRtdb(ctx, 'POST', parseBody(ctx));
  return { outputs: { result: data }, logs: ['RTDB push (POST)'] };
}

async function rtdbDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const data = await callRtdb(ctx, 'DELETE');
  return { outputs: { result: data }, logs: ['RTDB delete'] };
}

const block: ForgeBlock = {
  id: 'forge_google_firebase_rtdb',
  name: 'Firebase Realtime Database',
  description: 'Read, write, push, and delete nodes in a Firebase Realtime Database.',
  iconName: 'LuFlame',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'read',
      label: 'Read',
      description: 'Fetch the value at the given path.',
      fields: [...authFields, ...targetFields],
      run: rtdbRead,
    },
    {
      id: 'write',
      label: 'Write (PUT)',
      description: 'Replace the value at the given path.',
      fields: [
        ...authFields,
        ...targetFields,
        { id: 'value', label: 'Value (JSON)', type: 'json', required: true },
      ],
      run: rtdbWrite,
    },
    {
      id: 'push',
      label: 'Push (POST)',
      description: 'Append a child with an auto-generated key.',
      fields: [
        ...authFields,
        ...targetFields,
        { id: 'value', label: 'Value (JSON)', type: 'json', required: true },
      ],
      run: rtdbPush,
    },
    {
      id: 'delete',
      label: 'Delete',
      description: 'Delete the value at the given path.',
      fields: [...authFields, ...targetFields],
      run: rtdbDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;
