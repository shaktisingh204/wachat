/**
 * Forge block: Substack (public RSS / posts)
 *
 * Substack has no official write API. We expose read endpoints that work with
 * publication subdomains, plus a generic feed fetch.
 *
 * Operations covered:
 *   - posts.list                GET https://{sub}.substack.com/api/v1/posts
 *   - post.bySlug               GET https://{sub}.substack.com/api/v1/posts/{slug}
 *   - feed.rss                  GET https://{sub}.substack.com/feed
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

function baseUrl(ctx: ForgeActionContext): string {
  const sub = asString(ctx.options.subdomain);
  if (!sub) throw new Error('Substack: subdomain is required');
  return `https://${sub}.substack.com`;
}

function authHeader(ctx: ForgeActionContext): Record<string, string> {
  const cookie = asString(ctx.options.cookie);
  return cookie ? { Cookie: cookie } : {};
}

async function postsList(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const base = baseUrl(ctx);
  const params = new URLSearchParams();
  const limit = asString(ctx.options.limit);
  const offset = asString(ctx.options.offset);
  if (limit) params.set('limit', limit);
  if (offset) params.set('offset', offset);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Substack',
    method: 'GET',
    url: `${base}/api/v1/posts${qs ? `?${qs}` : ''}`,
    headers: authHeader(ctx),
  });
  return { outputs: { posts: res.data }, logs: [`Substack posts list → ${base}`] };
}

async function postBySlug(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const base = baseUrl(ctx);
  const slug = asString(ctx.options.slug);
  if (!slug) throw new Error('Substack: slug is required');
  const res = await apiRequest({
    service: 'Substack',
    method: 'GET',
    url: `${base}/api/v1/posts/${encodeURIComponent(slug)}`,
    headers: authHeader(ctx),
  });
  return { outputs: { post: res.data }, logs: [`Substack post bySlug → ${slug}`] };
}

async function feedRss(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const base = baseUrl(ctx);
  const res = await apiRequest({
    service: 'Substack',
    method: 'GET',
    url: `${base}/feed`,
    headers: authHeader(ctx),
  });
  return { outputs: { rss: res.text }, logs: [`Substack feed RSS → ${base}`] };
}

const block: ForgeBlock = {
  id: 'forge_substack',
  name: 'Substack',
  description: 'Read posts and RSS from any Substack publication.',
  iconName: 'LuFileText',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'posts_list',
      label: 'List posts',
      description: 'List recent posts on a publication.',
      fields: [
        { id: 'subdomain', label: 'Subdomain', type: 'text', required: true, placeholder: 'platformer' },
        { id: 'cookie', label: 'Cookie (optional)', type: 'password' },
        { id: 'limit', label: 'Limit', type: 'number' },
        { id: 'offset', label: 'Offset', type: 'number' },
      ],
      run: postsList,
    },
    {
      id: 'post_by_slug',
      label: 'Get post by slug',
      description: 'Fetch a single post.',
      fields: [
        { id: 'subdomain', label: 'Subdomain', type: 'text', required: true },
        { id: 'slug', label: 'Slug', type: 'text', required: true },
        { id: 'cookie', label: 'Cookie (optional)', type: 'password' },
      ],
      run: postBySlug,
    },
    {
      id: 'feed_rss',
      label: 'Fetch RSS feed',
      description: 'Return the publication RSS feed XML.',
      fields: [
        { id: 'subdomain', label: 'Subdomain', type: 'text', required: true },
      ],
      run: feedRss,
    },
  ],
};

registerForgeBlock(block);
export default block;
