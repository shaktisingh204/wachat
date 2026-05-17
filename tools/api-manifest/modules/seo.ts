/**
 * SEO suite — audit, rank tracking, GSC integration, internal mesh,
 * indexing pings, AI assistance, content briefs.
 *
 * Forwards to (planned) `/v1/seo/*` Rust paths. Some endpoints currently
 * route through the Next.js workers; the Rust crates will land in a
 * later phase. The manifest contract stays the same regardless.
 */

import type { EndpointSpec } from '../types';
import { crudExtendedResource } from '../crud-extended';

const generic2xx = { description: 'OK', schema: { type: 'object' as const } };
const auth = {
  '401': { description: 'Missing or invalid API key' },
  '429': { description: 'Rate limit exceeded' },
};

function seoVerb(
  resource: string,
  path: string,
  rustPath: string,
  method: EndpointSpec['method'],
  summary: string,
  scope = 'seo:write',
): EndpointSpec {
  const hasBody = ['POST', 'PATCH', 'PUT'].includes(method);
  return {
    module: 'seo',
    resource,
    verb: 'custom',
    path,
    method,
    scope,
    tier: 'PRO',
    summary,
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: rustPath, method },
    ...(hasBody ? { requestBody: { required: true, schema: { type: 'object' } } } : {}),
  };
}

export const seoEndpoints: ReadonlyArray<EndpointSpec> = [
  /* ── Sites + projects ─────────────────────────────────────────────────── */
  ...crudExtendedResource({
    module: 'seo',
    resource: 'sites',
    basePath: '/seo/sites',
    rustPath: '/v1/seo/sites',
    scopeRead: 'seo:read',
    scopeWrite: 'seo:write',
  }),
  ...crudExtendedResource({
    module: 'seo',
    resource: 'keywords',
    basePath: '/seo/keywords',
    rustPath: '/v1/seo/keywords',
    scopeRead: 'seo:read',
    scopeWrite: 'seo:write',
  }),
  ...crudExtendedResource({
    module: 'seo',
    resource: 'competitors',
    basePath: '/seo/competitors',
    rustPath: '/v1/seo/competitors',
    scopeRead: 'seo:read',
    scopeWrite: 'seo:write',
  }),
  ...crudExtendedResource({
    module: 'seo',
    resource: 'backlinks',
    basePath: '/seo/backlinks',
    rustPath: '/v1/seo/backlinks',
    scopeRead: 'seo:read',
    scopeWrite: 'seo:write',
  }),

  /* ── Audit ────────────────────────────────────────────────────────────── */
  seoVerb('audit', '/seo/audit/run', '/v1/seo/audit/run', 'POST', 'Trigger a site audit', 'seo:write'),
  seoVerb('audit', '/seo/audit/status', '/v1/seo/audit/status', 'GET', 'Audit job status', 'seo:read'),
  seoVerb('audit', '/seo/audit/results', '/v1/seo/audit/results', 'GET', 'Latest audit results', 'seo:read'),
  seoVerb('audit', '/seo/audit/pages', '/v1/seo/audit/pages', 'GET', 'Audited page list', 'seo:read'),
  seoVerb('audit', '/seo/audit/issues', '/v1/seo/audit/issues', 'GET', 'Per-page issues list', 'seo:read'),
  seoVerb('audit', '/seo/audit/report-pdf', '/v1/seo/audit/report-pdf', 'GET', 'Audit report PDF download', 'seo:read'),

  /* ── Rank tracking ────────────────────────────────────────────────────── */
  seoVerb('rank', '/seo/rank/snapshot', '/v1/seo/rank/snapshot', 'POST', 'Trigger a fresh rank snapshot', 'seo:write'),
  seoVerb('rank', '/seo/rank/positions', '/v1/seo/rank/positions', 'GET', 'Current keyword positions', 'seo:read'),
  seoVerb('rank', '/seo/rank/history', '/v1/seo/rank/history', 'GET', 'Rank history over time', 'seo:read'),
  seoVerb('rank', '/seo/rank/share-of-voice', '/v1/seo/rank/share-of-voice', 'GET', 'Share-of-voice vs competitors', 'seo:read'),
  seoVerb('rank', '/seo/rank/visibility-score', '/v1/seo/rank/visibility-score', 'GET', 'Visibility score', 'seo:read'),

  /* ── GSC + Bing webmaster ─────────────────────────────────────────────── */
  seoVerb('gsc', '/seo/gsc/connect', '/v1/seo/gsc/connect', 'POST', 'Connect Google Search Console', 'seo:write'),
  seoVerb('gsc', '/seo/gsc/disconnect', '/v1/seo/gsc/disconnect', 'POST', 'Disconnect GSC', 'seo:write'),
  seoVerb('gsc', '/seo/gsc/properties', '/v1/seo/gsc/properties', 'GET', 'List connected GSC properties', 'seo:read'),
  seoVerb('gsc', '/seo/gsc/queries', '/v1/seo/gsc/queries', 'GET', 'GSC top queries', 'seo:read'),
  seoVerb('gsc', '/seo/gsc/pages', '/v1/seo/gsc/pages', 'GET', 'GSC top pages', 'seo:read'),
  seoVerb('gsc', '/seo/gsc/coverage', '/v1/seo/gsc/coverage', 'GET', 'GSC index coverage', 'seo:read'),
  seoVerb('gsc', '/seo/gsc/sitemaps', '/v1/seo/gsc/sitemaps', 'GET', 'GSC submitted sitemaps', 'seo:read'),
  seoVerb('gsc', '/seo/gsc/submit-sitemap', '/v1/seo/gsc/submit-sitemap', 'POST', 'Submit a sitemap to GSC', 'seo:write'),

  /* ── Indexing ─────────────────────────────────────────────────────────── */
  seoVerb('indexing', '/seo/indexing/google', '/v1/seo/indexing/google', 'POST', 'Notify Google IndexNow', 'seo:write'),
  seoVerb('indexing', '/seo/indexing/bing', '/v1/seo/indexing/bing', 'POST', 'Notify Bing IndexNow', 'seo:write'),
  seoVerb('indexing', '/seo/indexing/status', '/v1/seo/indexing/status', 'GET', 'Per-URL indexing status', 'seo:read'),

  /* ── Internal-mesh (link planning) ────────────────────────────────────── */
  seoVerb('mesh', '/seo/mesh/graph', '/v1/seo/mesh/graph', 'GET', 'Internal-link graph snapshot', 'seo:read'),
  seoVerb('mesh', '/seo/mesh/recommendations', '/v1/seo/mesh/recommendations', 'GET', 'Suggested new internal links', 'seo:read'),
  seoVerb('mesh', '/seo/mesh/anchor-text', '/v1/seo/mesh/anchor-text', 'GET', 'Anchor-text distribution', 'seo:read'),

  /* ── AI assistants ────────────────────────────────────────────────────── */
  seoVerb('ai', '/seo/ai/content-brief', '/v1/seo/ai/content-brief', 'POST', 'Generate a content brief', 'seo:write'),
  seoVerb('ai', '/seo/ai/title-tags', '/v1/seo/ai/title-tags', 'POST', 'Suggest title-tag variants', 'seo:write'),
  seoVerb('ai', '/seo/ai/meta-descriptions', '/v1/seo/ai/meta-descriptions', 'POST', 'Suggest meta-description variants', 'seo:write'),
  seoVerb('ai', '/seo/ai/faq-schema', '/v1/seo/ai/faq-schema', 'POST', 'Generate FAQPage JSON-LD', 'seo:write'),
  seoVerb('ai', '/seo/ai/keyword-clusters', '/v1/seo/ai/keyword-clusters', 'POST', 'Cluster a keyword list', 'seo:write'),

  /* ── Local SEO ────────────────────────────────────────────────────────── */
  seoVerb('local', '/seo/local/listings', '/v1/seo/local/listings', 'GET', 'Local listings status', 'seo:read'),
  seoVerb('local', '/seo/local/citations', '/v1/seo/local/citations', 'GET', 'Citation health', 'seo:read'),
  seoVerb('local', '/seo/local/reviews', '/v1/seo/local/reviews', 'GET', 'Review aggregations', 'seo:read'),

  /* ── Brand monitoring ─────────────────────────────────────────────────── */
  seoVerb('brand', '/seo/brand/mentions', '/v1/seo/brand/mentions', 'GET', 'Brand mention stream', 'seo:read'),
  seoVerb('brand', '/seo/brand/sentiment', '/v1/seo/brand/sentiment', 'GET', 'Brand sentiment summary', 'seo:read'),
];
