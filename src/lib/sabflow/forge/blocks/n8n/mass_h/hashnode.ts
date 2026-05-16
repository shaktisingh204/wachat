/**
 * Forge block: Hashnode
 *
 * GraphQL API at `https://gql.hashnode.com/`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const ENDPOINT = 'https://gql.hashnode.com/';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const token = asString(ctx.options.apiKey);
  if (!token) throw new Error('Hashnode: apiKey is required');
  return { Authorization: token };
}

async function gql(ctx: ForgeActionContext, query: string, variables: Record<string, unknown>, log: string): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'Hashnode',
    method: 'POST',
    url: ENDPOINT,
    headers: authHeaders(ctx),
    json: { query, variables },
  });
  return { outputs: { result: res.data }, logs: [log] };
}

async function getMe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  return gql(ctx, `query { me { id username name email tagline } }`, {}, 'Hashnode get me');
}

async function publishPost(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const publicationId = asString(ctx.options.publicationId);
  const title = asString(ctx.options.title);
  const contentMarkdown = asString(ctx.options.contentMarkdown);
  if (!publicationId) throw new Error('Hashnode: publicationId is required');
  if (!title) throw new Error('Hashnode: title is required');
  if (!contentMarkdown) throw new Error('Hashnode: contentMarkdown is required');
  const mutation = `mutation Publish($input: PublishPostInput!) {
    publishPost(input: $input) { post { id slug url title } }
  }`;
  return gql(ctx, mutation, { input: { publicationId, title, contentMarkdown } }, `Hashnode publishPost → ${title}`);
}

async function getPublication(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const host = asString(ctx.options.host);
  if (!host) throw new Error('Hashnode: host is required');
  const query = `query Pub($host: String!) {
    publication(host: $host) { id title displayTitle url about { markdown } }
  }`;
  return gql(ctx, query, { host }, `Hashnode getPublication → ${host}`);
}

async function listPosts(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const host = asString(ctx.options.host);
  const first = Number(asString(ctx.options.first) || '10');
  if (!host) throw new Error('Hashnode: host is required');
  const query = `query Posts($host: String!, $first: Int!) {
    publication(host: $host) {
      posts(first: $first) { edges { node { id slug title brief url publishedAt } } }
    }
  }`;
  return gql(ctx, query, { host, first }, `Hashnode listPosts → ${host}`);
}

const block: ForgeBlock = {
  id: 'forge_hashnode',
  name: 'Hashnode',
  description: 'Interact with Hashnode publications via GraphQL.',
  iconName: 'LuRss',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'me',
      label: 'Get current user',
      fields: [{ id: 'apiKey', label: 'Personal access token', type: 'password', required: true }],
      run: getMe,
    },
    {
      id: 'publish_post',
      label: 'Publish post',
      fields: [
        { id: 'apiKey', label: 'Personal access token', type: 'password', required: true },
        { id: 'publicationId', label: 'Publication ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'contentMarkdown', label: 'Content (Markdown)', type: 'textarea', required: true },
      ],
      run: publishPost,
    },
    {
      id: 'get_publication',
      label: 'Get publication',
      fields: [
        { id: 'apiKey', label: 'Personal access token', type: 'password', required: true },
        { id: 'host', label: 'Host (e.g. myblog.hashnode.dev)', type: 'text', required: true },
      ],
      run: getPublication,
    },
    {
      id: 'list_posts',
      label: 'List posts',
      fields: [
        { id: 'apiKey', label: 'Personal access token', type: 'password', required: true },
        { id: 'host', label: 'Host', type: 'text', required: true },
        { id: 'first', label: 'First N', type: 'number', defaultValue: 10 },
      ],
      run: listPosts,
    },
  ],
};

registerForgeBlock(block);
export default block;
