/**
 * Forge block: Dev.to
 *
 * `https://dev.to/api` — articles list/get + publish.
 * Auth: `api-key` header (user API key).
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asBoolean, asString } from '../_shared/http';

const API = 'https://dev.to/api';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Dev.to: apiKey is required');
  return { 'api-key': apiKey };
}

async function listArticles(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const page = asString(ctx.options.page);
  const perPage = asString(ctx.options.perPage);
  const tag = asString(ctx.options.tag);
  const params = new URLSearchParams();
  if (page) params.set('page', page);
  if (perPage) params.set('per_page', perPage);
  if (tag) params.set('tag', tag);
  const qs = params.toString();
  const res = await apiRequest({
    service: 'Dev.to',
    method: 'GET',
    url: `${API}/articles${qs ? `?${qs}` : ''}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { articles: res.data }, logs: ['Dev.to list articles'] };
}

async function getArticle(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.articleId);
  if (!id) throw new Error('Dev.to: articleId is required');
  const res = await apiRequest({
    service: 'Dev.to',
    method: 'GET',
    url: `${API}/articles/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { article: res.data }, logs: [`Dev.to get article → ${id}`] };
}

async function createArticle(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const title = asString(ctx.options.title);
  const bodyMarkdown = asString(ctx.options.bodyMarkdown);
  const published = asBoolean(ctx.options.published);
  const tagsRaw = asString(ctx.options.tags);
  if (!title) throw new Error('Dev.to: title is required');
  if (!bodyMarkdown) throw new Error('Dev.to: bodyMarkdown is required');
  const article: Record<string, unknown> = { title, body_markdown: bodyMarkdown, published };
  if (tagsRaw) article.tags = tagsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  const res = await apiRequest({
    service: 'Dev.to',
    method: 'POST',
    url: `${API}/articles`,
    headers: authHeaders(ctx),
    json: { article },
  });
  return { outputs: { article: res.data }, logs: [`Dev.to create article → ${title}`] };
}

async function updateArticle(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.articleId);
  if (!id) throw new Error('Dev.to: articleId is required');
  const article: Record<string, unknown> = {};
  const title = asString(ctx.options.title);
  const bodyMarkdown = asString(ctx.options.bodyMarkdown);
  const published = asString(ctx.options.published);
  if (title) article.title = title;
  if (bodyMarkdown) article.body_markdown = bodyMarkdown;
  if (published) article.published = asBoolean(published);
  const res = await apiRequest({
    service: 'Dev.to',
    method: 'PUT',
    url: `${API}/articles/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
    json: { article },
  });
  return { outputs: { article: res.data }, logs: [`Dev.to update article → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_devto',
  name: 'Dev.to',
  description: 'Read, create and update Dev.to articles via the Forem API.',
  iconName: 'LuRss',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'list_articles',
      label: 'List articles',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'tag', label: 'Tag', type: 'text' },
        { id: 'page', label: 'Page', type: 'number' },
        { id: 'perPage', label: 'Per page', type: 'number' },
      ],
      run: listArticles,
    },
    {
      id: 'get_article',
      label: 'Get article',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'articleId', label: 'Article ID', type: 'text', required: true },
      ],
      run: getArticle,
    },
    {
      id: 'create_article',
      label: 'Create article',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'bodyMarkdown', label: 'Body (Markdown)', type: 'textarea', required: true },
        { id: 'tags', label: 'Tags (comma-separated)', type: 'text' },
        { id: 'published', label: 'Published', type: 'toggle' },
      ],
      run: createArticle,
    },
    {
      id: 'update_article',
      label: 'Update article',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'articleId', label: 'Article ID', type: 'text', required: true },
        { id: 'title', label: 'Title', type: 'text' },
        { id: 'bodyMarkdown', label: 'Body (Markdown)', type: 'textarea' },
        { id: 'published', label: 'Published', type: 'text', placeholder: 'true / false' },
      ],
      run: updateArticle,
    },
  ],
};

registerForgeBlock(block);
export default block;
