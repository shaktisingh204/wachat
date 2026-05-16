/**
 * Forge block: Taiga
 *
 * Source: n8n-master/packages/nodes-base/nodes/Taiga/Taiga.node.ts
 * Credential type: 'taiga' (CREDENTIAL_FIELD_SCHEMAS → { baseUrl, username, password }).
 *
 * Taiga issues an auth token via POST /api/v1/auth (normal-login). We exchange
 * username/password per call to keep this stateless.
 *
 * Operations covered (issue subset):
 *   - issue.create   POST   /api/v1/issues
 *   - issue.get      GET    /api/v1/issues/{id}
 *   - issue.update   PATCH  /api/v1/issues/{id}
 *   - issue.delete   DELETE /api/v1/issues/{id}
 *   - issue.list     GET    /api/v1/issues?project={projectId}
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

type TaigaCred = { baseUrl: string; username: string; password: string };

function getCred(ctx: ForgeActionContext): TaigaCred {
  const cred = requireCredential('Taiga', ctx.credential);
  const baseUrl = (cred.baseUrl ?? cred.url ?? 'https://api.taiga.io').replace(/\/+$/, '');
  const username = cred.username;
  const password = cred.password;
  if (!username || !password) throw new Error('Taiga: credential is missing `username` / `password`');
  return { baseUrl, username, password };
}

async function login(c: TaigaCred): Promise<string> {
  const res = await apiRequest({
    service: 'Taiga',
    method: 'POST',
    url: `${c.baseUrl}/api/v1/auth`,
    json: { type: 'normal', username: c.username, password: c.password },
  });
  const body = res.data as { auth_token?: string; token?: string };
  const tok = body.auth_token ?? body.token;
  if (!tok) throw new Error('Taiga: login did not return a token');
  return tok;
}

async function authHeaders(c: TaigaCred): Promise<Record<string, string>> {
  const tok = await login(c);
  return { Authorization: `Bearer ${tok}` };
}

async function issueCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const project = asString(ctx.options.project);
  const subject = asString(ctx.options.subject);
  if (!project) throw new Error('Taiga: project is required');
  if (!subject) throw new Error('Taiga: subject is required');
  const body: Record<string, unknown> = { project: Number(project), subject };
  const description = asString(ctx.options.description);
  if (description) body.description = description;
  const tagsStr = asString(ctx.options.tags);
  if (tagsStr) body.tags = tagsStr.split(',').map((s) => s.trim()).filter(Boolean);

  const headers = await authHeaders(c);
  const res = await apiRequest({
    service: 'Taiga',
    method: 'POST',
    url: `${c.baseUrl}/api/v1/issues`,
    headers,
    json: body,
  });
  return { outputs: { issue: res.data }, logs: [`Taiga issue create → ${(res.data as { id?: number })?.id}`] };
}

async function issueGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Taiga: id is required');
  const headers = await authHeaders(c);
  const res = await apiRequest({
    service: 'Taiga',
    method: 'GET',
    url: `${c.baseUrl}/api/v1/issues/${encodeURIComponent(id)}`,
    headers,
  });
  return { outputs: { issue: res.data }, logs: [`Taiga issue get → ${id}`] };
}

async function issueUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const id = asString(ctx.options.id);
  const version = asString(ctx.options.version);
  if (!id) throw new Error('Taiga: id is required');
  if (!version) throw new Error('Taiga: version is required (Taiga uses optimistic locking)');

  const body: Record<string, unknown> = { version: Number(version) };
  let any = false;
  for (const key of ['subject', 'description'] as const) {
    const v = asString(ctx.options[key]);
    if (v) {
      body[key] = v;
      any = true;
    }
  }
  if (!any) throw new Error('Taiga: at least one updatable field must be set');

  const headers = await authHeaders(c);
  const res = await apiRequest({
    service: 'Taiga',
    method: 'PATCH',
    url: `${c.baseUrl}/api/v1/issues/${encodeURIComponent(id)}`,
    headers,
    json: body,
  });
  return { outputs: { issue: res.data }, logs: [`Taiga issue update → ${id}`] };
}

async function issueDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const id = asString(ctx.options.id);
  if (!id) throw new Error('Taiga: id is required');
  const headers = await authHeaders(c);
  await apiRequest({
    service: 'Taiga',
    method: 'DELETE',
    url: `${c.baseUrl}/api/v1/issues/${encodeURIComponent(id)}`,
    headers,
  });
  return { outputs: { success: true }, logs: [`Taiga issue delete → ${id}`] };
}

async function issueList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const c = getCred(ctx);
  const project = asString(ctx.options.project);
  if (!project) throw new Error('Taiga: project is required');
  const headers = await authHeaders(c);
  const res = await apiRequest({
    service: 'Taiga',
    method: 'GET',
    url: `${c.baseUrl}/api/v1/issues?project=${encodeURIComponent(project)}`,
    headers,
  });
  const arr = Array.isArray(res.data) ? res.data : [];
  return { outputs: { issues: arr }, logs: [`Taiga issues list → ${arr.length}`] };
}

const block: ForgeBlock = {
  id: 'forge_taiga',
  name: 'Taiga',
  description: 'Create, update and list Taiga issues from a flow.',
  iconName: 'LuFolderKanban',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'taiga' },
  actions: [
    {
      id: 'issue_create',
      label: 'Create issue',
      description: 'Create a new issue in a project.',
      fields: [
        { id: 'project', label: 'Project ID', type: 'text', required: true },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'tags', label: 'Tags (comma separated)', type: 'text' },
      ],
      run: issueCreate,
    },
    {
      id: 'issue_get',
      label: 'Get issue',
      description: 'Fetch a single issue by id.',
      fields: [{ id: 'id', label: 'Issue ID', type: 'text', required: true }],
      run: issueGet,
    },
    {
      id: 'issue_update',
      label: 'Update issue',
      description: 'Patch an issue. Taiga requires the current version.',
      fields: [
        { id: 'id', label: 'Issue ID', type: 'text', required: true },
        { id: 'version', label: 'Version', type: 'number', required: true },
        { id: 'subject', label: 'Subject', type: 'text' },
        { id: 'description', label: 'Description', type: 'textarea' },
      ],
      run: issueUpdate,
    },
    {
      id: 'issue_delete',
      label: 'Delete issue',
      description: 'Permanently delete an issue.',
      fields: [{ id: 'id', label: 'Issue ID', type: 'text', required: true }],
      run: issueDelete,
    },
    {
      id: 'issue_list',
      label: 'List issues',
      description: 'List all issues in a project.',
      fields: [{ id: 'project', label: 'Project ID', type: 'text', required: true }],
      run: issueList,
    },
  ],
};

registerForgeBlock(block);
export default block;
