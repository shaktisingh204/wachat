/**
 * Forge block: GitLab
 *
 * Source: n8n-master/packages/nodes-base/nodes/Gitlab/Gitlab.node.ts
 * Credential type: 'gitlab' (expects { accessToken, baseUrl? }).
 *
 * Operations covered:
 *   - issue.create        POST /projects/:projectId/issues
 *   - issue.get           GET  /projects/:projectId/issues/:iid
 *   - issue.list          GET  /projects/:projectId/issues
 *   - project.get         GET  /projects/:projectId
 *   - pipeline.trigger    POST /projects/:projectId/pipeline?ref=…
 *
 * Deferred (re-add when needed):
 *   - merge request, release, comments
 *   - pagination beyond per_page hint
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const DEFAULT_BASE = 'https://gitlab.com';

function gitlabBase(ctx: ForgeActionContext): { base: string; token: string } {
  const cred = requireCredential('GitLab', ctx.credential);
  const token = cred.accessToken;
  if (!token) throw new Error('GitLab: credential is missing `accessToken`');
  const base = (cred.baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  return { base: `${base}/api/v4`, token };
}

function encodeProject(p: string): string {
  // GitLab accepts either numeric id or URL-encoded path "group/project".
  return /^\d+$/.test(p) ? p : encodeURIComponent(p);
}

async function issueCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  const title = asString(ctx.options.title);
  if (!projectId) throw new Error('GitLab: projectId is required');
  if (!title) throw new Error('GitLab: title is required');

  const { base, token } = gitlabBase(ctx);
  const description = asString(ctx.options.description);
  const labels = asString(ctx.options.labels);
  const assigneeIds = asString(ctx.options.assigneeIds);

  const payload: Record<string, unknown> = { title };
  if (description) payload.description = description;
  if (labels) payload.labels = labels;
  if (assigneeIds) {
    payload.assignee_ids = assigneeIds
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
  }

  const res = await apiRequest({
    service: 'GitLab',
    method: 'POST',
    url: `${base}/projects/${encodeProject(projectId)}/issues`,
    headers: { 'PRIVATE-TOKEN': token },
    json: payload,
  });

  const issue = res.data as { iid?: number; id?: number; title?: string };
  return {
    outputs: { issue },
    logs: [`GitLab issue create → ${projectId}#${issue?.iid ?? '?'}`],
  };
}

async function issueGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  const iid = asString(ctx.options.issueIid);
  if (!projectId) throw new Error('GitLab: projectId is required');
  if (!iid) throw new Error('GitLab: issueIid is required');

  const { base, token } = gitlabBase(ctx);
  const res = await apiRequest({
    service: 'GitLab',
    method: 'GET',
    url: `${base}/projects/${encodeProject(projectId)}/issues/${encodeURIComponent(iid)}`,
    headers: { 'PRIVATE-TOKEN': token },
  });

  return {
    outputs: { issue: res.data },
    logs: [`GitLab issue get → ${projectId}#${iid}`],
  };
}

async function issueList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  if (!projectId) throw new Error('GitLab: projectId is required');

  const { base, token } = gitlabBase(ctx);
  const params = new URLSearchParams();
  const state = asString(ctx.options.state);
  const perPage = asString(ctx.options.perPage);
  if (state) params.set('state', state);
  if (perPage) params.set('per_page', perPage);

  const qs = params.toString();
  const res = await apiRequest({
    service: 'GitLab',
    method: 'GET',
    url: `${base}/projects/${encodeProject(projectId)}/issues${qs ? `?${qs}` : ''}`,
    headers: { 'PRIVATE-TOKEN': token },
  });

  const issues = Array.isArray(res.data) ? res.data : [];
  return {
    outputs: { issues, count: issues.length },
    logs: [`GitLab issue list → ${projectId} (${issues.length})`],
  };
}

async function projectGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  if (!projectId) throw new Error('GitLab: projectId is required');

  const { base, token } = gitlabBase(ctx);
  const res = await apiRequest({
    service: 'GitLab',
    method: 'GET',
    url: `${base}/projects/${encodeProject(projectId)}`,
    headers: { 'PRIVATE-TOKEN': token },
  });

  return {
    outputs: { project: res.data },
    logs: [`GitLab project get → ${projectId}`],
  };
}

async function pipelineTrigger(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const projectId = asString(ctx.options.projectId);
  const ref = asString(ctx.options.ref);
  if (!projectId) throw new Error('GitLab: projectId is required');
  if (!ref) throw new Error('GitLab: ref is required');

  const { base, token } = gitlabBase(ctx);
  const params = new URLSearchParams({ ref });
  const res = await apiRequest({
    service: 'GitLab',
    method: 'POST',
    url: `${base}/projects/${encodeProject(projectId)}/pipeline?${params.toString()}`,
    headers: { 'PRIVATE-TOKEN': token },
  });

  return {
    outputs: { pipeline: res.data },
    logs: [`GitLab pipeline trigger → ${projectId}@${ref}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_gitlab',
  name: 'GitLab',
  description: 'Create and read GitLab issues, projects and pipelines.',
  iconName: 'LuGitBranch',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'gitlab' },
  actions: [
    {
      id: 'issue_create',
      label: 'Create issue',
      description: 'Open a new issue in a GitLab project.',
      fields: [
        { id: 'projectId', label: 'Project (id or path)', type: 'text', required: true, placeholder: '12345 or group/repo' },
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'labels', label: 'Labels (comma-separated)', type: 'text' },
        { id: 'assigneeIds', label: 'Assignee IDs (comma-separated)', type: 'text' },
      ],
      run: issueCreate,
    },
    {
      id: 'issue_get',
      label: 'Get issue',
      description: 'Fetch a single issue by IID.',
      fields: [
        { id: 'projectId', label: 'Project (id or path)', type: 'text', required: true },
        { id: 'issueIid', label: 'Issue IID', type: 'text', required: true },
      ],
      run: issueGet,
    },
    {
      id: 'issue_list',
      label: 'List issues',
      description: 'List issues in a project.',
      fields: [
        { id: 'projectId', label: 'Project (id or path)', type: 'text', required: true },
        {
          id: 'state',
          label: 'State',
          type: 'select',
          options: [
            { label: 'All', value: '' },
            { label: 'Opened', value: 'opened' },
            { label: 'Closed', value: 'closed' },
          ],
        },
        { id: 'perPage', label: 'Per page', type: 'number', placeholder: '20' },
      ],
      run: issueList,
    },
    {
      id: 'project_get',
      label: 'Get project',
      description: 'Fetch project metadata.',
      fields: [
        { id: 'projectId', label: 'Project (id or path)', type: 'text', required: true },
      ],
      run: projectGet,
    },
    {
      id: 'pipeline_trigger',
      label: 'Trigger pipeline',
      description: 'Create a new pipeline for a ref.',
      fields: [
        { id: 'projectId', label: 'Project (id or path)', type: 'text', required: true },
        { id: 'ref', label: 'Ref (branch / tag)', type: 'text', required: true, placeholder: 'main' },
      ],
      run: pipelineTrigger,
    },
  ],
};

registerForgeBlock(block);
export default block;
