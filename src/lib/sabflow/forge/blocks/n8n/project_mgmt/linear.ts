/**
 * Forge block: Linear
 *
 * Source: n8n-master/packages/nodes-base/nodes/Linear/Linear.node.ts (+ Queries.ts)
 * Credential type: 'linear' (matches CREDENTIAL_FIELD_SCHEMAS in
 *   src/lib/sabflow/credentials/types.ts → { apiKey: 'lin_api_…' }).
 *
 * Operations covered (subset of issue + comment resources):
 *   - issue.get          GraphQL `issue($id)`
 *   - issue.create       GraphQL `issueCreate(...)`
 *   - issue.update       GraphQL `issueUpdate($id, input)`
 *   - issue.delete       GraphQL `issueDelete($id)`
 *   - issue.getAll       GraphQL `issues(first, after)` walked via paginateAll
 *   - issue.addLink      GraphQL `attachmentLinkURL`
 *   - issue.addComment   GraphQL `commentCreate({ issueId, body })`
 *
 * Out of scope for the first port:
 *   - label assignment, project ops — re-add when needed (no callers yet)
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asNumber, asString, requireCredential } from '../_shared/http';
import { paginateAll } from '../_shared/paginate';

const ENDPOINT = 'https://api.linear.app/graphql';

async function gql<T = unknown>(
  ctx: ForgeActionContext,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  // Linear sends the api key verbatim in Authorization (no `Bearer ` prefix);
  // handled by the `raw` scheme.
  requireCredential('Linear', ctx.credential);
  const res = await ctx.helpers!.requestWithAuthentication('raw', {
    method: 'POST',
    url: ENDPOINT,
    tokenField: 'apiKey',
    json: { query, variables },
  });
  if (!res.ok) {
    const text =
      typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? null);
    const clip = text.length > 300 ? `${text.slice(0, 300)}…` : text;
    throw new Error(`Linear POST ${ENDPOINT} failed (${res.status}): ${clip}`);
  }
  const body = res.data as { data?: T; errors?: Array<{ message: string }> };
  if (body?.errors?.length) {
    throw new Error(`Linear GraphQL: ${body.errors.map((e) => e.message).join('; ')}`);
  }
  return body.data as T;
}

// ── Actions ────────────────────────────────────────────────────────────────

async function issueGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const issueId = asString(ctx.options.issueId);
  if (!issueId) throw new Error('Linear: issueId is required');
  const data = await gql<{ issue: unknown }>(
    ctx,
    `query Issue($id: String!) {
      issue(id: $id) {
        id identifier title description priority dueDate createdAt
        assignee { id displayName }
        state { id name }
        team { id name }
      }
    }`,
    { id: issueId },
  );
  return { outputs: { issue: data.issue }, logs: [`Linear issue get → ${issueId}`] };
}

async function issueCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const teamId = asString(ctx.options.teamId);
  const title = asString(ctx.options.title);
  if (!teamId) throw new Error('Linear: teamId is required');
  if (!title) throw new Error('Linear: title is required');

  const data = await gql<{ issueCreate: { success: boolean; issue: { id: string; identifier: string } } }>(
    ctx,
    `mutation IssueCreate(
      $title: String!, $teamId: String!,
      $description: String, $assigneeId: String, $stateId: String, $priority: Int
    ) {
      issueCreate(input: {
        title: $title, teamId: $teamId,
        description: $description, assigneeId: $assigneeId,
        stateId: $stateId, priority: $priority
      }) {
        success
        issue { id identifier title }
      }
    }`,
    {
      title,
      teamId,
      description: asString(ctx.options.description) || undefined,
      assigneeId: asString(ctx.options.assigneeId) || undefined,
      stateId: asString(ctx.options.stateId) || undefined,
      priority: ctx.options.priority ? Number(ctx.options.priority) : undefined,
    },
  );

  return {
    outputs: { issue: data.issueCreate.issue, success: data.issueCreate.success },
    logs: [`Linear issue create → ${data.issueCreate.issue?.identifier ?? '?'}`],
  };
}

async function issueUpdate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const issueId = asString(ctx.options.issueId);
  if (!issueId) throw new Error('Linear: issueId is required');

  const input: Record<string, unknown> = {};
  if (asString(ctx.options.title)) input.title = asString(ctx.options.title);
  if (asString(ctx.options.description)) input.description = asString(ctx.options.description);
  if (asString(ctx.options.stateId)) input.stateId = asString(ctx.options.stateId);
  if (asString(ctx.options.assigneeId)) input.assigneeId = asString(ctx.options.assigneeId);
  if (ctx.options.priority !== undefined && ctx.options.priority !== '') {
    input.priority = Number(ctx.options.priority);
  }
  if (Object.keys(input).length === 0) {
    throw new Error('Linear: at least one updatable field must be set');
  }

  const data = await gql<{ issueUpdate: { success: boolean; issue: { id: string; identifier: string } } }>(
    ctx,
    `mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue { id identifier title }
      }
    }`,
    { id: issueId, input },
  );

  return {
    outputs: { issue: data.issueUpdate.issue, success: data.issueUpdate.success },
    logs: [`Linear issue update → ${issueId}`],
  };
}

async function issueDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const issueId = asString(ctx.options.issueId);
  if (!issueId) throw new Error('Linear: issueId is required');
  const data = await gql<{ issueDelete: { success: boolean } }>(
    ctx,
    `mutation IssueDelete($id: String!) {
      issueDelete(id: $id) { success }
    }`,
    { id: issueId },
  );
  return { outputs: { success: data.issueDelete.success }, logs: [`Linear issue delete → ${issueId}`] };
}

// Mirrors n8n's `query.getIssues()` with `pageInfo.endCursor` cursor.
async function issueGetAll(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const returnAll = ctx.options.returnAll === true;
  const limit = asNumber(ctx.options.limit);
  const maxItems = returnAll ? undefined : limit ?? 50;

  const items = await paginateAll<unknown>({
    maxItems,
    async fetchPage(cursor) {
      const data = await gql<{
        issues: { nodes: unknown[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
      }>(
        ctx,
        `query Issues($first: Int, $after: String) {
          issues(first: $first, after: $after) {
            nodes {
              id identifier title priority archivedAt createdAt description dueDate
              assignee { id displayName }
              state { id name }
              creator { id displayName }
              cycle { id name }
            }
            pageInfo { hasNextPage endCursor }
          }
        }`,
        { first: 50, after: cursor ?? null },
      );
      return {
        items: data.issues.nodes,
        nextCursor: data.issues.pageInfo.hasNextPage ? data.issues.pageInfo.endCursor ?? undefined : undefined,
      };
    },
  });

  return { outputs: { issues: items, count: items.length }, logs: [`Linear issues list → ${items.length}`] };
}

// Linear stores external links via `attachmentLinkURL`, the same call n8n uses for `issue.addLink`.
async function issueAddLink(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const issueId = asString(ctx.options.issueId);
  const link = asString(ctx.options.link);
  if (!issueId) throw new Error('Linear: issueId is required');
  if (!link) throw new Error('Linear: link is required');
  const data = await gql<{ attachmentLinkURL: { success: boolean } }>(
    ctx,
    `mutation AttachmentLinkURL($url: String!, $issueId: String!) {
      attachmentLinkURL(url: $url, issueId: $issueId) { success }
    }`,
    { issueId, url: link },
  );
  return { outputs: { success: data.attachmentLinkURL.success }, logs: [`Linear addLink → ${issueId}`] };
}

async function issueAddComment(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const issueId = asString(ctx.options.issueId);
  const bodyText = asString(ctx.options.body);
  if (!issueId) throw new Error('Linear: issueId is required');
  if (!bodyText) throw new Error('Linear: comment body is required');

  const data = await gql<{ commentCreate: { success: boolean; comment: { id: string } } }>(
    ctx,
    `mutation CommentCreate($issueId: String!, $body: String!) {
      commentCreate(input: { issueId: $issueId, body: $body }) {
        success
        comment { id body createdAt }
      }
    }`,
    { issueId, body: bodyText },
  );

  return {
    outputs: { comment: data.commentCreate.comment, success: data.commentCreate.success },
    logs: [`Linear comment → ${issueId}`],
  };
}

// ── Block ─────────────────────────────────────────────────────────────────

const block: ForgeBlock = {
  id: 'forge_linear',
  name: 'Linear',
  description: 'Create, update and comment on Linear issues from a flow.',
  iconName: 'LuLayoutList',
  category: 'Integration',
  auth: {
    type: 'apiKey',
    credentialType: 'linear',
  },
  actions: [
    {
      id: 'issue_get',
      label: 'Get issue',
      description: 'Fetch a single issue by id.',
      fields: [
        { id: 'issueId', label: 'Issue ID', type: 'text', required: true, placeholder: 'abc-123' },
      ],
      run: issueGet,
    },
    {
      id: 'issue_create',
      label: 'Create issue',
      description: 'Create a new issue in a team.',
      fields: [
        { id: 'teamId', label: 'Team ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'assigneeId', label: 'Assignee ID', type: 'text' },
        { id: 'stateId', label: 'State ID', type: 'text' },
        {
          id: 'priority',
          label: 'Priority',
          type: 'select',
          options: [
            { label: 'No priority', value: '0' },
            { label: 'Urgent', value: '1' },
            { label: 'High', value: '2' },
            { label: 'Medium', value: '3' },
            { label: 'Low', value: '4' },
          ],
        },
      ],
      run: issueCreate,
    },
    {
      id: 'issue_update',
      label: 'Update issue',
      description: 'Patch an existing issue. Only set fields are sent.',
      fields: [
        { id: 'issueId', label: 'Issue ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'description', label: 'Description', type: 'textarea' },
        { id: 'assigneeId', label: 'Assignee ID', type: 'text' },
        { id: 'stateId', label: 'State ID', type: 'text' },
        {
          id: 'priority',
          label: 'Priority',
          type: 'select',
          options: [
            { label: 'Unchanged', value: '' },
            { label: 'No priority', value: '0' },
            { label: 'Urgent', value: '1' },
            { label: 'High', value: '2' },
            { label: 'Medium', value: '3' },
            { label: 'Low', value: '4' },
          ],
        },
      ],
      run: issueUpdate,
    },
    {
      id: 'issue_delete',
      label: 'Delete issue',
      description: 'Permanently delete an issue.',
      fields: [
        { id: 'issueId', label: 'Issue ID', type: 'text', required: true },
      ],
      run: issueDelete,
    },
    {
      id: 'issue_get_all',
      label: 'List issues',
      description: 'List issues across the workspace, optionally capped at a limit.',
      fields: [
        { id: 'returnAll', label: 'Return all', type: 'toggle', defaultValue: false },
        { id: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
      ],
      run: issueGetAll,
    },
    {
      id: 'issue_add_link',
      label: 'Add link to issue',
      description: 'Attach an external URL to an issue (Linear Attachment).',
      fields: [
        { id: 'issueId', label: 'Issue ID', type: 'text', required: true },
        { id: 'link', label: 'URL', type: 'text', required: true, placeholder: 'https://...' },
      ],
      run: issueAddLink,
    },
    {
      id: 'issue_add_comment',
      label: 'Add comment to issue',
      description: 'Post a comment on an existing issue.',
      fields: [
        { id: 'issueId', label: 'Issue ID', type: 'text', required: true },
        { id: 'body', label: 'Comment', type: 'textarea', required: true },
      ],
      run: issueAddComment,
    },
  ],
};

registerForgeBlock(block);
export default block;
