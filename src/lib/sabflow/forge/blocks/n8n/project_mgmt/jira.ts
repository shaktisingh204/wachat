/**
 * Forge block: Jira (Cloud)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Jira/Jira.node.ts (1805 LOC)
 * Credential type: 'jira' (CREDENTIAL_FIELD_SCHEMAS → { baseUrl, email, apiToken }).
 *
 * Operations covered (issue + comment subset):
 *   - issue.create   POST   /rest/api/2/issue
 *   - issue.get      GET    /rest/api/2/issue/{key}
 *   - issue.update   PUT    /rest/api/2/issue/{key}
 *   - issue.delete   DELETE /rest/api/2/issue/{key}
 *   - issue.addComment POST /rest/api/2/issue/{key}/comment
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

type JiraCred = { baseUrl: string; email: string; apiToken: string };

function getCred(ctx: ForgeActionContext): JiraCred {
  const cred = requireCredential('Jira', ctx.credential);
  const baseUrl = (cred.baseUrl ?? '').replace(/\/+$/, '');
  const email = cred.email;
  const apiToken = cred.apiToken;
  if (!baseUrl) throw new Error('Jira: credential is missing `baseUrl`');
  if (!email) throw new Error('Jira: credential is missing `email`');
  if (!apiToken) throw new Error('Jira: credential is missing `apiToken`');
  return { baseUrl, email, apiToken };
}

function authHeaders(c: JiraCred): Record<string, string> {
  const basic = btoa(`${c.email}:${c.apiToken}`);
  return { Authorization: `Basic ${basic}`, Accept: 'application/json' };
}

async function issueCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const projectKey = asString(ctx.options.projectKey);
  const summary = asString(ctx.options.summary);
  const issueTypeName = asString(ctx.options.issueTypeName) || 'Task';
  if (!projectKey) throw new Error('Jira: projectKey is required');
  if (!summary) throw new Error('Jira: summary is required');

  const fields: Record<string, unknown> = {
    project: { key: projectKey },
    summary,
    issuetype: { name: issueTypeName },
  };
  const description = asString(ctx.options.description);
  if (description) fields.description = description;
  const assigneeAccountId = asString(ctx.options.assigneeAccountId);
  if (assigneeAccountId) fields.assignee = { accountId: assigneeAccountId };
  const labels = asString(ctx.options.labels);
  if (labels) fields.labels = labels.split(',').map((s) => s.trim()).filter(Boolean);
  const priority = asString(ctx.options.priority);
  if (priority) fields.priority = { name: priority };

  const res = await apiRequest({
    service: 'Jira',
    method: 'POST',
    url: `${cred.baseUrl}/rest/api/2/issue`,
    headers: authHeaders(cred),
    json: { fields },
  });
  return { outputs: { issue: res.data }, logs: [`Jira issue create → ${(res.data as { key?: string })?.key}`] };
}

async function issueGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const issueKey = asString(ctx.options.issueKey);
  if (!issueKey) throw new Error('Jira: issueKey is required');
  const res = await apiRequest({
    service: 'Jira',
    method: 'GET',
    url: `${cred.baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}`,
    headers: authHeaders(cred),
  });
  return { outputs: { issue: res.data }, logs: [`Jira issue get → ${issueKey}`] };
}

async function issueUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const issueKey = asString(ctx.options.issueKey);
  if (!issueKey) throw new Error('Jira: issueKey is required');

  const fields: Record<string, unknown> = {};
  const summary = asString(ctx.options.summary);
  if (summary) fields.summary = summary;
  const description = asString(ctx.options.description);
  if (description) fields.description = description;
  const assigneeAccountId = asString(ctx.options.assigneeAccountId);
  if (assigneeAccountId) fields.assignee = { accountId: assigneeAccountId };
  const priority = asString(ctx.options.priority);
  if (priority) fields.priority = { name: priority };
  const labels = asString(ctx.options.labels);
  if (labels) fields.labels = labels.split(',').map((s) => s.trim()).filter(Boolean);

  if (Object.keys(fields).length === 0) {
    throw new Error('Jira: at least one updatable field must be set');
  }

  await apiRequest({
    service: 'Jira',
    method: 'PUT',
    url: `${cred.baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}`,
    headers: authHeaders(cred),
    json: { fields },
  });
  return { outputs: { success: true, key: issueKey }, logs: [`Jira issue update → ${issueKey}`] };
}

async function issueDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const issueKey = asString(ctx.options.issueKey);
  if (!issueKey) throw new Error('Jira: issueKey is required');
  await apiRequest({
    service: 'Jira',
    method: 'DELETE',
    url: `${cred.baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}`,
    headers: authHeaders(cred),
  });
  return { outputs: { success: true }, logs: [`Jira issue delete → ${issueKey}`] };
}

async function issueSearchAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const jql = asString(ctx.options.jql);
  if (!jql) throw new Error('Jira: jql is required');
  const maxItems = asNumber(ctx.options.maxItems) ?? 500;
  const pageSize = asNumber(ctx.options.pageSize) ?? 50;
  const fields = asString(ctx.options.fields);

  const issues = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const startAt = Number(cursor ?? '0');
      const qs = new URLSearchParams();
      qs.set('jql', jql);
      qs.set('startAt', String(startAt));
      qs.set('maxResults', String(pageSize));
      if (fields) qs.set('fields', fields);
      const res = await apiRequest({
        service: 'Jira',
        method: 'GET',
        url: `${cred.baseUrl}/rest/api/2/search?${qs.toString()}`,
        headers: authHeaders(cred),
      });
      const body = res.data as {
        issues?: unknown[];
        startAt?: number;
        maxResults?: number;
        total?: number;
        isLast?: boolean;
      } | null;
      const items = (body?.issues ?? []) as unknown[];
      const consumed = startAt + items.length;
      // Jira returns `isLast` for some endpoints; for /search, use total.
      const more =
        body?.isLast === false ||
        (typeof body?.total === 'number' && consumed < body.total && items.length === pageSize);
      const nextCursor = more ? String(consumed) : undefined;
      return { items, nextCursor };
    },
  });

  return {
    outputs: { issues, count: issues.length },
    logs: [`Jira issue search all → ${issues.length}`],
  };
}

async function issueAddComment(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const cred = getCred(ctx);
  const issueKey = asString(ctx.options.issueKey);
  const body = asString(ctx.options.body);
  if (!issueKey) throw new Error('Jira: issueKey is required');
  if (!body) throw new Error('Jira: body is required');
  const res = await apiRequest({
    service: 'Jira',
    method: 'POST',
    url: `${cred.baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment`,
    headers: authHeaders(cred),
    json: { body },
  });
  return { outputs: { comment: res.data }, logs: [`Jira comment → ${issueKey}`] };
}

const block: ForgeBlock = {
  id: 'forge_jira',
  name: 'Jira',
  description: 'Create, update and comment on Jira issues from a flow.',
  iconName: 'LuBug',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'jira' },
  actions: [
    {
      id: 'issue_create',
      label: 'Create issue',
      description: 'Create a new issue in a project.',
      fields: [
        { id: 'projectKey', label: 'Project key', type: 'text', required: true, placeholder: 'PROJ' },
        { id: 'summary', label: 'Summary', type: 'text', required: true },
        { id: 'issueTypeName', label: 'Issue type', type: 'text', defaultValue: 'Task' },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'assigneeAccountId', label: 'Assignee account ID', type: 'text' },
        { id: 'priority', label: 'Priority (e.g. High)', type: 'text' },
        { id: 'labels', label: 'Labels (comma separated)', type: 'text' },
      ],
      run: issueCreate,
    },
    {
      id: 'issue_get',
      label: 'Get issue',
      description: 'Fetch a single issue by key.',
      fields: [{ id: 'issueKey', label: 'Issue key', type: 'text', required: true, placeholder: 'PROJ-123' }],
      run: issueGet,
    },
    {
      id: 'issue_update',
      label: 'Update issue',
      description: 'Patch an issue. Only set fields are sent.',
      fields: [
        { id: 'issueKey', label: 'Issue key', type: 'text', required: true },
        { id: 'summary', label: 'Summary', type: 'text' },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'assigneeAccountId', label: 'Assignee account ID', type: 'text' },
        { id: 'priority', label: 'Priority', type: 'text' },
        { id: 'labels', label: 'Labels (comma separated)', type: 'text' },
      ],
      run: issueUpdate,
    },
    {
      id: 'issue_delete',
      label: 'Delete issue',
      description: 'Permanently delete an issue.',
      fields: [{ id: 'issueKey', label: 'Issue key', type: 'text', required: true }],
      run: issueDelete,
    },
    {
      id: 'issue_search_all',
      label: 'Search all issues (paginated)',
      description: 'Run a JQL search and walk startAt/maxResults pagination until isLast or the cap is reached.',
      fields: [
        { id: 'jql', label: 'JQL', type: 'textarea', required: true, placeholder: 'project = PROJ AND status = "To Do"' },
        { id: 'fields', label: 'Fields (comma separated, optional)', type: 'text', placeholder: 'summary,status,assignee' },
        { id: 'maxItems', label: 'Max items (cap)', type: 'number', defaultValue: '500' },
        { id: 'pageSize', label: 'Page size (max 100)', type: 'number', defaultValue: '50' },
      ],
      run: issueSearchAll,
    },
    {
      id: 'issue_add_comment',
      label: 'Add comment to issue',
      description: 'Post a comment on an issue.',
      fields: [
        { id: 'issueKey', label: 'Issue key', type: 'text', required: true },
        { id: 'body', label: 'Comment', type: 'textarea', required: true },
      ],
      run: issueAddComment,
    },
  ],
};

registerForgeBlock(block);
export default block;
