/**
 * Forge block: Linear (Issue Search)
 *
 * API: https://developers.linear.app/docs/graphql/working-with-the-graphql-api
 * Auth: `Authorization: <api_key>` (personal API key prefixed with `lin_api_`).
 *
 * Operations covered (GraphQL):
 *   - issue.search              issues(filter: {...})
 *   - issue.get                 issue(id: ...)
 *   - team.list                 teams
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.linear.app/graphql';

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const key = asString(ctx.options.apiKey);
  if (!key) throw new Error('Linear: apiKey is required');
  return { Authorization: key };
}

async function gql<T = unknown>(
  ctx: ForgeActionContext,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await apiRequest({
    service: 'Linear',
    method: 'POST',
    url: API,
    headers: authHeader(ctx),
    json: { query, variables },
  });
  const data = res.data as { data?: T; errors?: Array<{ message: string }> };
  if (data?.errors?.length) throw new Error(`Linear: ${data.errors.map((e) => e.message).join('; ')}`);
  return data?.data as T;
}

async function issueSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const term = asString(ctx.options.term);
  const first = Number(asString(ctx.options.first) || '25');
  const query = `query Search($term: String!, $first: Int!) {
    issues(filter: { title: { contains: $term } }, first: $first) {
      nodes { id identifier title state { name } assignee { name } url }
    }
  }`;
  const data = await gql<{ issues: { nodes: unknown[] } }>(ctx, query, { term, first });
  return { outputs: { issues: data?.issues?.nodes ?? [] }, logs: [`Linear issue search → ${term}`] };
}

async function issueGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.issueId);
  if (!id) throw new Error('Linear: issueId is required');
  const query = `query Get($id: String!) {
    issue(id: $id) { id identifier title description state { name } assignee { name } url }
  }`;
  const data = await gql<{ issue: unknown }>(ctx, query, { id });
  return { outputs: { issue: data?.issue }, logs: [`Linear issue get → ${id}`] };
}

async function teamList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = `query Teams { teams { nodes { id name key } } }`;
  const data = await gql<{ teams: { nodes: unknown[] } }>(ctx, query, {});
  return { outputs: { teams: data?.teams?.nodes ?? [] }, logs: ['Linear team list'] };
}

const block: ForgeBlock = {
  id: 'forge_linear_search',
  name: 'Linear (Issue Search)',
  description: 'Search and fetch Linear issues; list teams.',
  iconName: 'LuSearch',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'issue_search',
      label: 'Search issues',
      description: 'Search issues by title substring.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'term', label: 'Term', type: 'text', required: true },
        { id: 'first', label: 'First', type: 'number', defaultValue: '25' },
      ],
      run: issueSearch,
    },
    {
      id: 'issue_get',
      label: 'Get issue',
      description: 'Fetch a single issue by id.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'issueId', label: 'Issue ID', type: 'text', required: true },
      ],
      run: issueGet,
    },
    {
      id: 'team_list',
      label: 'List teams',
      description: 'List all teams in the workspace.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
      ],
      run: teamList,
    },
  ],
};

registerForgeBlock(block);
export default block;
