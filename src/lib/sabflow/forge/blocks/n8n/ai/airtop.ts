/**
 * Forge block: Airtop
 *
 * Source: n8n-master/packages/nodes-base/nodes/Airtop/Airtop.node.ts
 * Credential type: 'airtop' (expects { apiKey }).
 *
 * Endpoint: https://api.airtop.ai/api/v1
 * Auth: Authorization: Bearer <apiKey>
 *
 * Operations:
 *   - session.create        POST /sessions
 *   - session.terminate     DELETE /sessions/{id}
 *   - session.list          GET  /sessions
 *   - window.create         POST /sessions/{id}/windows
 *   - profile.run           POST /sessions  (with configuration.profileName)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const API = 'https://api.airtop.ai/api/v1';

function bearer(ctx: ForgeActionContext): string {
  const cred = requireCredential('Airtop', ctx.credential);
  const key = cred.apiKey ?? cred.accessToken;
  if (!key) throw new Error('Airtop: credential is missing `apiKey`');
  return `Bearer ${key}`;
}

async function sessionCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const payload: Record<string, unknown> = {};
  const timeout = asString(ctx.options.timeoutMinutes);
  if (timeout) payload.configuration = { timeoutMinutes: Number(timeout) };

  const res = await apiRequest({
    service: 'Airtop',
    method: 'POST',
    url: `${API}/sessions`,
    headers: { Authorization: bearer(ctx) },
    json: payload,
  });
  const body = res.data as { data?: { id?: string } };
  return {
    outputs: { session: res.data, sessionId: body?.data?.id ?? '' },
    logs: [`Airtop session create → ${body?.data?.id ?? '?'}`],
  };
}

async function sessionTerminate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sessionId = asString(ctx.options.sessionId);
  if (!sessionId) throw new Error('Airtop: sessionId is required');

  const res = await apiRequest({
    service: 'Airtop',
    method: 'DELETE',
    url: `${API}/sessions/${encodeURIComponent(sessionId)}`,
    headers: { Authorization: bearer(ctx) },
  });
  return {
    outputs: { result: res.data, terminated: true },
    logs: [`Airtop session terminate → ${sessionId}`],
  };
}

async function sessionList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Airtop',
    method: 'GET',
    url: `${API}/sessions`,
    headers: { Authorization: bearer(ctx) },
  });
  const body = res.data as { data?: unknown[] };
  const sessions = Array.isArray(body?.data) ? body.data : [];
  return {
    outputs: { sessions, count: sessions.length },
    logs: [`Airtop session list (${sessions.length})`],
  };
}

async function windowCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const sessionId = asString(ctx.options.sessionId);
  const url = asString(ctx.options.url);
  if (!sessionId) throw new Error('Airtop: sessionId is required');
  if (!url) throw new Error('Airtop: url is required');

  const res = await apiRequest({
    service: 'Airtop',
    method: 'POST',
    url: `${API}/sessions/${encodeURIComponent(sessionId)}/windows`,
    headers: { Authorization: bearer(ctx) },
    json: { url },
  });
  return {
    outputs: { window: res.data },
    logs: [`Airtop window create → ${sessionId}`],
  };
}

async function profileRun(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const profileName = asString(ctx.options.profileName);
  if (!profileName) throw new Error('Airtop: profileName is required');

  const res = await apiRequest({
    service: 'Airtop',
    method: 'POST',
    url: `${API}/sessions`,
    headers: { Authorization: bearer(ctx) },
    json: { configuration: { profileName } },
  });
  const body = res.data as { data?: { id?: string } };
  return {
    outputs: { session: res.data, sessionId: body?.data?.id ?? '' },
    logs: [`Airtop profile run → ${profileName} (${body?.data?.id ?? '?'})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_airtop',
  name: 'Airtop',
  description: 'Launch and control Airtop browser sessions and profiles.',
  iconName: 'LuMonitor',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'airtop' },
  actions: [
    {
      id: 'session_create',
      label: 'Create session',
      description: 'Start a new browser session.',
      fields: [
        { id: 'timeoutMinutes', label: 'Timeout (minutes)', type: 'number' },
      ],
      run: sessionCreate,
    },
    {
      id: 'session_terminate',
      label: 'Terminate session',
      description: 'Close a running session.',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
      ],
      run: sessionTerminate,
    },
    {
      id: 'session_list',
      label: 'List sessions',
      description: 'List running and recent sessions.',
      fields: [],
      run: sessionList,
    },
    {
      id: 'window_create',
      label: 'Open window',
      description: 'Open a URL inside an existing session.',
      fields: [
        { id: 'sessionId', label: 'Session ID', type: 'text', required: true },
        { id: 'url', label: 'URL', type: 'text', required: true },
      ],
      run: windowCreate,
    },
    {
      id: 'profile_run',
      label: 'Run profile',
      description: 'Start a session attached to a saved Airtop profile.',
      fields: [
        { id: 'profileName', label: 'Profile name', type: 'text', required: true },
      ],
      run: profileRun,
    },
  ],
};

registerForgeBlock(block);
export default block;
