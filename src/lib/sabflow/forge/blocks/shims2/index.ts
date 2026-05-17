/**
 * Step 29 — TypeScript shim executors (batch 2).
 *
 * Twenty more previously-stubbed integrations get real working executors here
 * so the `stub: true` banner stops showing for project trackers, helpdesks,
 * messaging providers, marketing analytics and transactional-email providers.
 *
 * Each block exposes its single highest-value action (the 80/20 cut); users
 * still reach the long tail via the HTTP Request block.
 *
 * Patterns mirror `../shims/index.ts`:
 *   - Bearer / Basic / api-token auth via `ctx.credential`
 *   - JSON request/response, error messages surfaced verbatim
 *   - Output written under `outputVariable` when set
 */

import { registerForgeBlock } from '../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../types';

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

async function jsonRequest(opts: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}): Promise<unknown> {
  const res = await fetch(opts.url, {
    method: opts.method,
    headers: { Accept: 'application/json', ...opts.headers },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  const data: unknown = text ? safeJsonParse(text) : null;
  if (!res.ok) {
    const detail =
      typeof data === 'string' ? data : data ? JSON.stringify(data).slice(0, 400) : '';
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${detail}`);
  }
  return data;
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function writeOutput(
  ctx: ForgeActionContext,
  value: unknown,
): Record<string, unknown> {
  const key = str(ctx.options.outputVariable);
  return key ? { [key]: value, result: value } : { result: value };
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function basic(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

/* ── 1. Asana ───────────────────────────────────────────────────────────── */

async function asanaCreateTask(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = ctx.credential?.accessToken ?? ctx.credential?.apiKey ?? ctx.credential?.token;
  if (!token) throw new Error('Asana: select a credential (Personal Access Token)');
  const projectId = str(ctx.options.projectId);
  const name = str(ctx.options.name);
  if (!projectId || !name) throw new Error('Asana: projectId + name are required');

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://app.asana.com/api/1.0/tasks',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: {
      data: {
        name,
        notes: str(ctx.options.notes) || undefined,
        projects: [projectId],
        assignee: str(ctx.options.assignee) || undefined,
        due_on: str(ctx.options.dueOn) || undefined,
      },
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Asana: task created "${name}"`] };
}

registerForgeBlock({
  id: 'forge_asana',
  name: 'Asana',
  description: 'Create tasks in an Asana project.',
  iconName: 'LuListTodo',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'asana' },
  actions: [
    {
      id: 'create_task',
      label: 'Create task',
      description: 'Add a task to an Asana project.',
      fields: [
        { id: 'projectId', label: 'Project ID', type: 'text', required: true },
        { id: 'name',      label: 'Task name', type: 'text', required: true },
        { id: 'notes',     label: 'Notes', type: 'textarea' },
        { id: 'assignee',  label: 'Assignee (gid or "me")', type: 'text' },
        { id: 'dueOn',     label: 'Due on (YYYY-MM-DD)', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: asanaCreateTask,
    },
  ],
});

/* ── 2. Linear ──────────────────────────────────────────────────────────── */

async function linearCreateIssue(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = ctx.credential?.apiKey ?? ctx.credential?.token;
  if (!apiKey) throw new Error('Linear: select a credential (API key)');
  const teamId = str(ctx.options.teamId);
  const title = str(ctx.options.title);
  if (!teamId || !title) throw new Error('Linear: teamId + title are required');

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://api.linear.app/graphql',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: {
      query:
        'mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title url } } }',
      variables: {
        input: {
          teamId,
          title,
          description: str(ctx.options.description) || undefined,
          priority: ctx.options.priority ? Number(ctx.options.priority) : undefined,
          assigneeId: str(ctx.options.assigneeId) || undefined,
        },
      },
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Linear: issue created "${title}"`] };
}

registerForgeBlock({
  id: 'forge_linear',
  name: 'Linear',
  description: 'Create issues in a Linear team.',
  iconName: 'LuLineChart',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'linear' },
  actions: [
    {
      id: 'create_issue',
      label: 'Create issue',
      description: 'File a new issue in Linear.',
      fields: [
        { id: 'teamId',      label: 'Team ID', type: 'text', required: true },
        { id: 'title',       label: 'Title', type: 'text', required: true },
        { id: 'description', label: 'Description (Markdown)', type: 'textarea' },
        { id: 'priority',    label: 'Priority (0-4)', type: 'number' },
        { id: 'assigneeId',  label: 'Assignee ID', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: linearCreateIssue,
    },
  ],
});

/* ── 3. Jira Cloud ──────────────────────────────────────────────────────── */

async function jiraCreateIssue(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = ctx.credential?.email ?? ctx.credential?.user;
  const apiToken = ctx.credential?.apiToken ?? ctx.credential?.apiKey ?? ctx.credential?.token;
  const domain = ctx.credential?.domain ?? ctx.credential?.host;
  if (!email || !apiToken || !domain) {
    throw new Error('Jira: credential needs email + apiToken + domain');
  }
  const projectKey = str(ctx.options.projectKey);
  const summary = str(ctx.options.summary);
  const issueType = str(ctx.options.issueType) || 'Task';
  if (!projectKey || !summary) throw new Error('Jira: projectKey + summary are required');

  const host = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const data = await jsonRequest({
    method: 'POST',
    url: `https://${host}/rest/api/3/issue`,
    headers: { Authorization: basic(email, apiToken), 'Content-Type': 'application/json' },
    body: {
      fields: {
        project: { key: projectKey },
        summary,
        issuetype: { name: issueType },
        description: str(ctx.options.description)
          ? {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: str(ctx.options.description) }],
                },
              ],
            }
          : undefined,
      },
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Jira: issue created in ${projectKey}`] };
}

registerForgeBlock({
  id: 'forge_jira',
  name: 'Jira Cloud',
  description: 'Create issues in a Jira Cloud project.',
  iconName: 'LuBug',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'jira' },
  actions: [
    {
      id: 'create_issue',
      label: 'Create issue',
      description: 'Open a new issue in a Jira project.',
      fields: [
        { id: 'projectKey',  label: 'Project key (e.g. ENG)', type: 'text', required: true },
        { id: 'summary',     label: 'Summary', type: 'text', required: true },
        { id: 'issueType',   label: 'Issue type', type: 'text' },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: jiraCreateIssue,
    },
  ],
});

/* ── 4. GitLab ──────────────────────────────────────────────────────────── */

async function gitlabCreateIssue(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = ctx.credential?.apiKey ?? ctx.credential?.token ?? ctx.credential?.accessToken;
  if (!token) throw new Error('GitLab: select a credential (Personal Access Token)');
  const baseUrl = (ctx.credential?.host ?? ctx.credential?.domain ?? 'https://gitlab.com')
    .replace(/\/$/, '');
  const projectId = str(ctx.options.projectId);
  const title = str(ctx.options.title);
  if (!projectId || !title) throw new Error('GitLab: projectId + title are required');

  const data = await jsonRequest({
    method: 'POST',
    url: `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/issues`,
    headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
    body: {
      title,
      description: str(ctx.options.description) || undefined,
      labels: str(ctx.options.labels) || undefined,
      assignee_ids: str(ctx.options.assigneeIds)
        ? str(ctx.options.assigneeIds)
            .split(',')
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n))
        : undefined,
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`GitLab: issue opened "${title}"`] };
}

registerForgeBlock({
  id: 'forge_gitlab',
  name: 'GitLab',
  description: 'Create issues in a GitLab project.',
  iconName: 'LuGitBranch',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'gitlab' },
  actions: [
    {
      id: 'create_issue',
      label: 'Create issue',
      description: 'Open a new issue in a GitLab project.',
      fields: [
        { id: 'projectId',   label: 'Project ID or path', type: 'text', required: true },
        { id: 'title',       label: 'Title', type: 'text', required: true },
        { id: 'description', label: 'Description (Markdown)', type: 'textarea' },
        { id: 'labels',      label: 'Labels (comma-sep)', type: 'text' },
        { id: 'assigneeIds', label: 'Assignee IDs (comma-sep)', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: gitlabCreateIssue,
    },
  ],
});

/* ── 5. Bitbucket Cloud ─────────────────────────────────────────────────── */

async function bitbucketCreateIssue(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const username = ctx.credential?.username ?? ctx.credential?.user;
  const appPassword = ctx.credential?.appPassword ?? ctx.credential?.password ?? ctx.credential?.apiKey;
  if (!username || !appPassword) {
    throw new Error('Bitbucket: credential needs username + appPassword');
  }
  const workspace = str(ctx.options.workspace);
  const repoSlug = str(ctx.options.repoSlug);
  const title = str(ctx.options.title);
  if (!workspace || !repoSlug || !title) {
    throw new Error('Bitbucket: workspace + repoSlug + title are required');
  }

  const data = await jsonRequest({
    method: 'POST',
    url: `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repoSlug)}/issues`,
    headers: { Authorization: basic(username, appPassword), 'Content-Type': 'application/json' },
    body: {
      title,
      content: str(ctx.options.content)
        ? { raw: str(ctx.options.content) }
        : undefined,
      kind: str(ctx.options.kind) || 'bug',
      priority: str(ctx.options.priority) || 'major',
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Bitbucket: issue created "${title}"`] };
}

registerForgeBlock({
  id: 'forge_bitbucket',
  name: 'Bitbucket Cloud',
  description: 'Create issues in a Bitbucket Cloud repository.',
  iconName: 'LuGitFork',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'bitbucket' },
  actions: [
    {
      id: 'create_issue',
      label: 'Create issue',
      description: 'File a new issue on a Bitbucket repo.',
      fields: [
        { id: 'workspace', label: 'Workspace', type: 'text', required: true },
        { id: 'repoSlug',  label: 'Repository slug', type: 'text', required: true },
        { id: 'title',     label: 'Title', type: 'text', required: true },
        { id: 'content',   label: 'Description (Markdown)', type: 'textarea' },
        { id: 'kind',      label: 'Kind', type: 'select',
          options: [
            { label: 'Bug', value: 'bug' },
            { label: 'Enhancement', value: 'enhancement' },
            { label: 'Proposal', value: 'proposal' },
            { label: 'Task', value: 'task' },
          ] },
        { id: 'priority',  label: 'Priority', type: 'select',
          options: [
            { label: 'Trivial', value: 'trivial' },
            { label: 'Minor', value: 'minor' },
            { label: 'Major', value: 'major' },
            { label: 'Critical', value: 'critical' },
            { label: 'Blocker', value: 'blocker' },
          ] },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: bitbucketCreateIssue,
    },
  ],
});

/* ── 6. Monday.com ──────────────────────────────────────────────────────── */

async function mondayCreateItem(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = ctx.credential?.apiKey ?? ctx.credential?.token;
  if (!apiKey) throw new Error('Monday: select a credential (API token)');
  const boardId = str(ctx.options.boardId);
  const itemName = str(ctx.options.itemName);
  if (!boardId || !itemName) throw new Error('Monday: boardId + itemName are required');

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://api.monday.com/v2',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: {
      query:
        'mutation ($boardId: ID!, $itemName: String!, $groupId: String, $columnValues: JSON) { create_item(board_id: $boardId, item_name: $itemName, group_id: $groupId, column_values: $columnValues) { id name } }',
      variables: {
        boardId,
        itemName,
        groupId: str(ctx.options.groupId) || null,
        columnValues: ctx.options.columnValues
          ? JSON.stringify(asObject(ctx.options.columnValues))
          : undefined,
      },
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Monday: item "${itemName}" on board ${boardId}`] };
}

registerForgeBlock({
  id: 'forge_monday',
  name: 'Monday.com',
  description: 'Create items on a Monday.com board.',
  iconName: 'LuTable',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'monday' as never },
  actions: [
    {
      id: 'create_item',
      label: 'Create item',
      description: 'Append an item to a board.',
      fields: [
        { id: 'boardId',      label: 'Board ID', type: 'text', required: true },
        { id: 'itemName',     label: 'Item name', type: 'text', required: true },
        { id: 'groupId',      label: 'Group ID', type: 'text' },
        { id: 'columnValues', label: 'Column values (JSON)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: mondayCreateItem,
    },
  ],
});

/* ── 7. Confluence ──────────────────────────────────────────────────────── */

async function confluenceCreatePage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = ctx.credential?.email ?? ctx.credential?.user;
  const apiToken = ctx.credential?.apiToken ?? ctx.credential?.apiKey ?? ctx.credential?.token;
  const domain = ctx.credential?.domain ?? ctx.credential?.host;
  if (!email || !apiToken || !domain) {
    throw new Error('Confluence: credential needs email + apiToken + domain');
  }
  const spaceKey = str(ctx.options.spaceKey);
  const title = str(ctx.options.title);
  const bodyHtml = str(ctx.options.body);
  if (!spaceKey || !title) throw new Error('Confluence: spaceKey + title are required');

  const host = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const data = await jsonRequest({
    method: 'POST',
    url: `https://${host}/wiki/rest/api/content`,
    headers: { Authorization: basic(email, apiToken), 'Content-Type': 'application/json' },
    body: {
      type: 'page',
      title,
      space: { key: spaceKey },
      ancestors: str(ctx.options.parentId) ? [{ id: str(ctx.options.parentId) }] : undefined,
      body: {
        storage: {
          value: bodyHtml || `<p>${title}</p>`,
          representation: 'storage',
        },
      },
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Confluence: page "${title}" in ${spaceKey}`] };
}

registerForgeBlock({
  id: 'forge_confluence',
  name: 'Confluence',
  description: 'Create pages in a Confluence space.',
  iconName: 'LuBookOpen',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'confluence' as never },
  actions: [
    {
      id: 'create_page',
      label: 'Create page',
      description: 'Publish a new page to a Confluence space.',
      fields: [
        { id: 'spaceKey', label: 'Space key', type: 'text', required: true },
        { id: 'title',    label: 'Title', type: 'text', required: true },
        { id: 'body',     label: 'Body (storage / HTML)', type: 'textarea' },
        { id: 'parentId', label: 'Parent page ID', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: confluenceCreatePage,
    },
  ],
});

/* ── 8. Coda ────────────────────────────────────────────────────────────── */

async function codaInsertRow(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = ctx.credential?.apiKey ?? ctx.credential?.token;
  if (!apiKey) throw new Error('Coda: select a credential (API token)');
  const docId = str(ctx.options.docId);
  const tableId = str(ctx.options.tableId);
  if (!docId || !tableId) throw new Error('Coda: docId + tableId are required');

  const cellsRaw = asObject(ctx.options.cells);
  const cells = Object.entries(cellsRaw).map(([column, value]) => ({ column, value }));
  if (cells.length === 0) throw new Error('Coda: cells must contain at least one column/value');

  const data = await jsonRequest({
    method: 'POST',
    url: `https://coda.io/apis/v1/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows`,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: { rows: [{ cells }] },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Coda: row inserted in ${docId}/${tableId}`] };
}

registerForgeBlock({
  id: 'forge_coda',
  name: 'Coda',
  description: 'Insert rows into a Coda table.',
  iconName: 'LuTable2',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'coda' },
  actions: [
    {
      id: 'insert_row',
      label: 'Insert row',
      description: 'Append a row to a Coda table.',
      fields: [
        { id: 'docId',   label: 'Doc ID', type: 'text', required: true },
        { id: 'tableId', label: 'Table ID', type: 'text', required: true },
        { id: 'cells',   label: 'Cells (JSON object: column→value)', type: 'json', required: true },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: codaInsertRow,
    },
  ],
});

/* ── 9. Mattermost ──────────────────────────────────────────────────────── */

async function mattermostPostMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = ctx.credential?.accessToken ?? ctx.credential?.apiKey ?? ctx.credential?.token;
  const host = ctx.credential?.host ?? ctx.credential?.domain ?? ctx.credential?.serverUrl;
  if (!token || !host) throw new Error('Mattermost: credential needs token + host');
  const channelId = str(ctx.options.channelId);
  const message = str(ctx.options.message);
  if (!channelId || !message) throw new Error('Mattermost: channelId + message are required');

  const base = host.replace(/\/$/, '');
  const data = await jsonRequest({
    method: 'POST',
    url: `${base}/api/v4/posts`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: {
      channel_id: channelId,
      message,
      root_id: str(ctx.options.rootId) || undefined,
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Mattermost: posted to ${channelId}`] };
}

registerForgeBlock({
  id: 'forge_mattermost',
  name: 'Mattermost',
  description: 'Post messages to a Mattermost channel.',
  iconName: 'LuMessageSquare',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'mattermost' },
  actions: [
    {
      id: 'post_message',
      label: 'Post message',
      description: 'Send a message to a Mattermost channel.',
      fields: [
        { id: 'channelId', label: 'Channel ID', type: 'text', required: true },
        { id: 'message',   label: 'Message', type: 'textarea', required: true },
        { id: 'rootId',    label: 'Reply to post ID (optional)', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: mattermostPostMessage,
    },
  ],
});

/* ── 10. Zendesk ────────────────────────────────────────────────────────── */

async function zendeskCreateTicket(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const email = ctx.credential?.email ?? ctx.credential?.user;
  const apiToken = ctx.credential?.apiToken ?? ctx.credential?.apiKey ?? ctx.credential?.token;
  const subdomain = ctx.credential?.subdomain ?? ctx.credential?.domain;
  if (!email || !apiToken || !subdomain) {
    throw new Error('Zendesk: credential needs email + apiToken + subdomain');
  }
  const subject = str(ctx.options.subject);
  const body = str(ctx.options.body);
  if (!subject || !body) throw new Error('Zendesk: subject + body are required');

  const host = subdomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const fqdn = host.includes('.') ? host : `${host}.zendesk.com`;
  const data = await jsonRequest({
    method: 'POST',
    url: `https://${fqdn}/api/v2/tickets.json`,
    headers: {
      Authorization: basic(`${email}/token`, apiToken),
      'Content-Type': 'application/json',
    },
    body: {
      ticket: {
        subject,
        comment: { body },
        priority: str(ctx.options.priority) || undefined,
        requester: str(ctx.options.requesterEmail)
          ? { email: str(ctx.options.requesterEmail) }
          : undefined,
      },
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Zendesk: ticket created "${subject}"`] };
}

registerForgeBlock({
  id: 'forge_zendesk',
  name: 'Zendesk',
  description: 'Create support tickets in Zendesk.',
  iconName: 'LuLifeBuoy',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'zendesk' },
  actions: [
    {
      id: 'create_ticket',
      label: 'Create ticket',
      description: 'Open a new ticket in Zendesk.',
      fields: [
        { id: 'subject',        label: 'Subject', type: 'text', required: true },
        { id: 'body',           label: 'Description', type: 'textarea', required: true },
        { id: 'priority',       label: 'Priority', type: 'select',
          options: [
            { label: 'Low', value: 'low' },
            { label: 'Normal', value: 'normal' },
            { label: 'High', value: 'high' },
            { label: 'Urgent', value: 'urgent' },
          ] },
        { id: 'requesterEmail', label: 'Requester email', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: zendeskCreateTicket,
    },
  ],
});

/* ── 11. Freshdesk ──────────────────────────────────────────────────────── */

async function freshdeskCreateTicket(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = ctx.credential?.apiKey ?? ctx.credential?.token;
  const domain = ctx.credential?.domain ?? ctx.credential?.subdomain ?? ctx.credential?.host;
  if (!apiKey || !domain) throw new Error('Freshdesk: credential needs apiKey + domain');
  const subject = str(ctx.options.subject);
  const email = str(ctx.options.email);
  const description = str(ctx.options.description);
  if (!subject || !email || !description) {
    throw new Error('Freshdesk: subject + email + description are required');
  }

  const host = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const fqdn = host.includes('.') ? host : `${host}.freshdesk.com`;
  const data = await jsonRequest({
    method: 'POST',
    url: `https://${fqdn}/api/v2/tickets`,
    headers: { Authorization: basic(apiKey, 'X'), 'Content-Type': 'application/json' },
    body: {
      subject,
      description,
      email,
      priority: ctx.options.priority ? Number(ctx.options.priority) : 1,
      status: ctx.options.status ? Number(ctx.options.status) : 2,
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Freshdesk: ticket created "${subject}"`] };
}

registerForgeBlock({
  id: 'forge_freshdesk',
  name: 'Freshdesk',
  description: 'Create support tickets in Freshdesk.',
  iconName: 'LuHeadphones',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'freshdesk' },
  actions: [
    {
      id: 'create_ticket',
      label: 'Create ticket',
      description: 'Open a new ticket in Freshdesk.',
      fields: [
        { id: 'subject',     label: 'Subject', type: 'text', required: true },
        { id: 'email',       label: 'Requester email', type: 'text', required: true },
        { id: 'description', label: 'Description (HTML)', type: 'textarea', required: true },
        { id: 'priority',    label: 'Priority (1-4)', type: 'number' },
        { id: 'status',      label: 'Status (2=open, 3=pending, 4=resolved, 5=closed)', type: 'number' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: freshdeskCreateTicket,
    },
  ],
});

/* ── 12. Intercom ───────────────────────────────────────────────────────── */

async function intercomSendMessage(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = ctx.credential?.accessToken ?? ctx.credential?.apiKey ?? ctx.credential?.token;
  if (!token) throw new Error('Intercom: select a credential (access token)');
  const userId = str(ctx.options.userId);
  const userEmail = str(ctx.options.userEmail);
  const body = str(ctx.options.body);
  if (!body || (!userId && !userEmail)) {
    throw new Error('Intercom: body + (userId or userEmail) are required');
  }

  const to: Record<string, string> = { type: 'user' };
  if (userId) to.id = userId;
  else to.email = userEmail;

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://api.intercom.io/messages',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: {
      message_type: str(ctx.options.messageType) || 'inapp',
      subject: str(ctx.options.subject) || undefined,
      body,
      from: { type: 'admin', id: str(ctx.options.fromAdminId) },
      to,
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Intercom: message sent to ${userId || userEmail}`] };
}

registerForgeBlock({
  id: 'forge_intercom',
  name: 'Intercom',
  description: 'Send in-app or email messages to Intercom users.',
  iconName: 'LuMessagesSquare',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'intercom' },
  actions: [
    {
      id: 'send_message',
      label: 'Send message',
      description: 'Send a message from an admin to a user.',
      fields: [
        { id: 'fromAdminId', label: 'From admin ID', type: 'text', required: true },
        { id: 'userId',      label: 'To user ID', type: 'text' },
        { id: 'userEmail',   label: 'To user email', type: 'text' },
        { id: 'messageType', label: 'Message type', type: 'select',
          options: [
            { label: 'In-app', value: 'inapp' },
            { label: 'Email', value: 'email' },
          ] },
        { id: 'subject',     label: 'Subject (email only)', type: 'text' },
        { id: 'body',        label: 'Body (HTML or plain)', type: 'textarea', required: true },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: intercomSendMessage,
    },
  ],
});

/* ── 13. Klaviyo ────────────────────────────────────────────────────────── */

async function klaviyoTrackEvent(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = ctx.credential?.apiKey ?? ctx.credential?.privateKey ?? ctx.credential?.token;
  if (!apiKey) throw new Error('Klaviyo: select a credential (private API key)');
  const metric = str(ctx.options.metric);
  const email = str(ctx.options.email);
  if (!metric || !email) throw new Error('Klaviyo: metric + email are required');

  const properties = asObject(ctx.options.properties);
  const data = await jsonRequest({
    method: 'POST',
    url: 'https://a.klaviyo.com/api/events/',
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      revision: '2024-10-15',
    },
    body: {
      data: {
        type: 'event',
        attributes: {
          properties,
          metric: { data: { type: 'metric', attributes: { name: metric } } },
          profile: { data: { type: 'profile', attributes: { email } } },
        },
      },
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Klaviyo: tracked "${metric}" for ${email}`] };
}

registerForgeBlock({
  id: 'forge_klaviyo',
  name: 'Klaviyo',
  description: 'Track events into Klaviyo for a profile.',
  iconName: 'LuChartPie',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'klaviyo' as never },
  actions: [
    {
      id: 'track_event',
      label: 'Track event',
      description: 'Send an event to the Klaviyo Events API.',
      fields: [
        { id: 'metric',     label: 'Metric name', type: 'text', required: true },
        { id: 'email',      label: 'Profile email', type: 'text', required: true },
        { id: 'properties', label: 'Properties (JSON)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: klaviyoTrackEvent,
    },
  ],
});

/* ── 14. Customer.io ────────────────────────────────────────────────────── */

async function customerioTrackEvent(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const siteId = ctx.credential?.siteId ?? ctx.credential?.user;
  const apiKey = ctx.credential?.apiKey ?? ctx.credential?.token ?? ctx.credential?.password;
  if (!siteId || !apiKey) throw new Error('Customer.io: credential needs siteId + apiKey');
  const customerId = str(ctx.options.customerId);
  const event = str(ctx.options.event);
  if (!customerId || !event) throw new Error('Customer.io: customerId + event are required');

  const data = await jsonRequest({
    method: 'POST',
    url: `https://track.customer.io/api/v1/customers/${encodeURIComponent(customerId)}/events`,
    headers: { Authorization: basic(siteId, apiKey), 'Content-Type': 'application/json' },
    body: {
      name: event,
      data: asObject(ctx.options.data),
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Customer.io: tracked "${event}" for ${customerId}`] };
}

registerForgeBlock({
  id: 'forge_customerio',
  name: 'Customer.io',
  description: 'Track events into Customer.io for a customer.',
  iconName: 'LuActivity',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'customerio' },
  actions: [
    {
      id: 'track_event',
      label: 'Track event',
      description: 'Send a behavioural event to Customer.io.',
      fields: [
        { id: 'customerId', label: 'Customer ID', type: 'text', required: true },
        { id: 'event',      label: 'Event name', type: 'text', required: true },
        { id: 'data',       label: 'Event data (JSON)', type: 'json' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: customerioTrackEvent,
    },
  ],
});

/* ── 15. Plivo ──────────────────────────────────────────────────────────── */

async function plivoSendSms(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const authId = ctx.credential?.authId ?? ctx.credential?.user ?? ctx.credential?.apiKey;
  const authToken = ctx.credential?.authToken ?? ctx.credential?.token ?? ctx.credential?.password;
  if (!authId || !authToken) throw new Error('Plivo: credential needs authId + authToken');
  const src = str(ctx.options.from);
  const dst = str(ctx.options.to);
  const text = str(ctx.options.text);
  if (!src || !dst || !text) throw new Error('Plivo: from + to + text are required');

  const data = await jsonRequest({
    method: 'POST',
    url: `https://api.plivo.com/v1/Account/${encodeURIComponent(authId)}/Message/`,
    headers: { Authorization: basic(authId, authToken), 'Content-Type': 'application/json' },
    body: { src, dst, text },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Plivo: SMS to ${dst}`] };
}

registerForgeBlock({
  id: 'forge_plivo',
  name: 'Plivo',
  description: 'Send SMS messages via Plivo.',
  iconName: 'LuPhone',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'plivo' },
  actions: [
    {
      id: 'send_sms',
      label: 'Send SMS',
      description: 'Send a one-way SMS via the Plivo API.',
      fields: [
        { id: 'from', label: 'From (Plivo number)', type: 'text', required: true },
        { id: 'to',   label: 'To (E.164)', type: 'text', required: true },
        { id: 'text', label: 'Message body', type: 'textarea', required: true },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: plivoSendSms,
    },
  ],
});

/* ── 16. MessageBird ────────────────────────────────────────────────────── */

async function messagebirdSendSms(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = ctx.credential?.apiKey ?? ctx.credential?.accessKey ?? ctx.credential?.token;
  if (!apiKey) throw new Error('MessageBird: select a credential (access key)');
  const originator = str(ctx.options.originator);
  const body = str(ctx.options.body);
  const recipients = str(ctx.options.recipients);
  if (!originator || !body || !recipients) {
    throw new Error('MessageBird: originator + body + recipients are required');
  }

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://rest.messagebird.com/messages',
    headers: { Authorization: `AccessKey ${apiKey}`, 'Content-Type': 'application/json' },
    body: {
      originator,
      body,
      recipients: recipients.split(/[,;\s]+/).filter(Boolean),
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`MessageBird: SMS sent`] };
}

registerForgeBlock({
  id: 'forge_messagebird',
  name: 'MessageBird',
  description: 'Send SMS messages via MessageBird.',
  iconName: 'LuSend',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'messagebird' },
  actions: [
    {
      id: 'send_sms',
      label: 'Send SMS',
      description: 'Send an SMS via the MessageBird REST API.',
      fields: [
        { id: 'originator', label: 'Originator (sender ID or number)', type: 'text', required: true },
        { id: 'recipients', label: 'Recipients (comma-sep, E.164)', type: 'text', required: true },
        { id: 'body',       label: 'Message body', type: 'textarea', required: true },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: messagebirdSendSms,
    },
  ],
});

/* ── 17. Vonage ─────────────────────────────────────────────────────────── */

async function vonageSendSms(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = ctx.credential?.apiKey ?? ctx.credential?.user;
  const apiSecret = ctx.credential?.apiSecret ?? ctx.credential?.password ?? ctx.credential?.token;
  if (!apiKey || !apiSecret) throw new Error('Vonage: credential needs apiKey + apiSecret');
  const from = str(ctx.options.from);
  const to = str(ctx.options.to);
  const text = str(ctx.options.text);
  if (!from || !to || !text) throw new Error('Vonage: from + to + text are required');

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://rest.nexmo.com/sms/json',
    headers: { 'Content-Type': 'application/json' },
    body: { api_key: apiKey, api_secret: apiSecret, from, to, text },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Vonage: SMS to ${to}`] };
}

registerForgeBlock({
  id: 'forge_vonage',
  name: 'Vonage',
  description: 'Send SMS messages via Vonage (Nexmo).',
  iconName: 'LuMessageCircle',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'vonage' },
  actions: [
    {
      id: 'send_sms',
      label: 'Send SMS',
      description: 'Send a one-way SMS via the Vonage REST API.',
      fields: [
        { id: 'from', label: 'From (sender ID or number)', type: 'text', required: true },
        { id: 'to',   label: 'To (E.164)', type: 'text', required: true },
        { id: 'text', label: 'Message body', type: 'textarea', required: true },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: vonageSendSms,
    },
  ],
});

/* ── 18. Postmark ───────────────────────────────────────────────────────── */

async function postmarkSendEmail(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = ctx.credential?.apiKey ?? ctx.credential?.serverToken ?? ctx.credential?.token;
  if (!apiKey) throw new Error('Postmark: select a credential (server token)');
  const from = str(ctx.options.from);
  const to = str(ctx.options.to);
  const subject = str(ctx.options.subject);
  if (!from || !to || !subject) throw new Error('Postmark: from + to + subject are required');

  const htmlBody = str(ctx.options.htmlBody);
  const textBody = str(ctx.options.textBody);
  if (!htmlBody && !textBody) throw new Error('Postmark: htmlBody or textBody is required');

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://api.postmarkapp.com/email',
    headers: {
      'X-Postmark-Server-Token': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: {
      From: from,
      To: to,
      Subject: subject,
      HtmlBody: htmlBody || undefined,
      TextBody: textBody || undefined,
      MessageStream: str(ctx.options.messageStream) || 'outbound',
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Postmark: email to ${to}`] };
}

registerForgeBlock({
  id: 'forge_postmark',
  name: 'Postmark',
  description: 'Send transactional email via Postmark.',
  iconName: 'LuMail',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'postmark' },
  actions: [
    {
      id: 'send_email',
      label: 'Send email',
      description: 'Send a single email via Postmark.',
      fields: [
        { id: 'from',          label: 'From', type: 'text', required: true },
        { id: 'to',            label: 'To (comma-sep)', type: 'text', required: true },
        { id: 'subject',       label: 'Subject', type: 'text', required: true },
        { id: 'htmlBody',      label: 'HTML body', type: 'textarea' },
        { id: 'textBody',      label: 'Text body', type: 'textarea' },
        { id: 'messageStream', label: 'Message stream', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: postmarkSendEmail,
    },
  ],
});

/* ── 19. Brevo (Sendinblue) ─────────────────────────────────────────────── */

async function brevoSendEmail(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = ctx.credential?.apiKey ?? ctx.credential?.token;
  if (!apiKey) throw new Error('Brevo: select a credential (API v3 key)');
  const fromEmail = str(ctx.options.fromEmail);
  const toEmail = str(ctx.options.toEmail);
  const subject = str(ctx.options.subject);
  if (!fromEmail || !toEmail || !subject) {
    throw new Error('Brevo: fromEmail + toEmail + subject are required');
  }
  const htmlContent = str(ctx.options.htmlContent);
  const textContent = str(ctx.options.textContent);
  if (!htmlContent && !textContent) {
    throw new Error('Brevo: htmlContent or textContent is required');
  }

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://api.brevo.com/v3/smtp/email',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: {
      sender: { email: fromEmail, name: str(ctx.options.fromName) || undefined },
      to: toEmail.split(/[,;\s]+/).filter(Boolean).map((email) => ({ email })),
      subject,
      htmlContent: htmlContent || undefined,
      textContent: textContent || undefined,
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Brevo: email to ${toEmail}`] };
}

registerForgeBlock({
  id: 'forge_brevo',
  name: 'Brevo',
  description: 'Send transactional email via Brevo (Sendinblue).',
  iconName: 'LuMailOpen',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'brevo' },
  actions: [
    {
      id: 'send_email',
      label: 'Send email',
      description: 'Send a single email via the Brevo SMTP API.',
      fields: [
        { id: 'fromEmail',   label: 'From email', type: 'text', required: true },
        { id: 'fromName',    label: 'From name', type: 'text' },
        { id: 'toEmail',     label: 'To (comma-sep)', type: 'text', required: true },
        { id: 'subject',     label: 'Subject', type: 'text', required: true },
        { id: 'htmlContent', label: 'HTML content', type: 'textarea' },
        { id: 'textContent', label: 'Text content', type: 'textarea' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: brevoSendEmail,
    },
  ],
});

/* ── 20. Resend ─────────────────────────────────────────────────────────── */

async function resendSendEmail(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = ctx.credential?.apiKey ?? ctx.credential?.token;
  if (!apiKey) throw new Error('Resend: select a credential (API key)');
  const from = str(ctx.options.from);
  const to = str(ctx.options.to);
  const subject = str(ctx.options.subject);
  if (!from || !to || !subject) throw new Error('Resend: from + to + subject are required');

  const html = str(ctx.options.html);
  const text = str(ctx.options.text);
  if (!html && !text) throw new Error('Resend: html or text is required');

  const data = await jsonRequest({
    method: 'POST',
    url: 'https://api.resend.com/emails',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: {
      from,
      to: to.split(/[,;\s]+/).filter(Boolean),
      subject,
      html: html || undefined,
      text: text || undefined,
      reply_to: str(ctx.options.replyTo) || undefined,
    },
  });
  return { outputs: writeOutput(ctx, data), logs: [`Resend: email to ${to}`] };
}

registerForgeBlock({
  id: 'forge_resend',
  name: 'Resend',
  description: 'Send transactional email via Resend.',
  iconName: 'LuSend',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'resend' },
  actions: [
    {
      id: 'send_email',
      label: 'Send email',
      description: 'Send a single email via the Resend API.',
      fields: [
        { id: 'from',    label: 'From', type: 'text', required: true },
        { id: 'to',      label: 'To (comma-sep)', type: 'text', required: true },
        { id: 'subject', label: 'Subject', type: 'text', required: true },
        { id: 'html',    label: 'HTML body', type: 'textarea' },
        { id: 'text',    label: 'Text body', type: 'textarea' },
        { id: 'replyTo', label: 'Reply-to', type: 'text' },
        { id: 'outputVariable', label: 'Save response to variable', type: 'text' },
      ],
      run: resendSendEmail,
    },
  ],
});

/* ── Shim block ids (exported for the registry barrel) ──────────────────── */
export const STEP_PLUS_SHIM_BLOCK_IDS = [
  'forge_asana',
  'forge_linear',
  'forge_jira',
  'forge_gitlab',
  'forge_bitbucket',
  'forge_monday',
  'forge_confluence',
  'forge_coda',
  'forge_mattermost',
  'forge_zendesk',
  'forge_freshdesk',
  'forge_intercom',
  'forge_klaviyo',
  'forge_customerio',
  'forge_plivo',
  'forge_messagebird',
  'forge_vonage',
  'forge_postmark',
  'forge_brevo',
  'forge_resend',
] as const;

// Re-export ForgeBlock so the file references the type and keeps the import non-unused
// in environments where type-only imports are elided.
export type { ForgeBlock };
