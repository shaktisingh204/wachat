/**
 * Phase 7 — marketing / social / utilities.
 *
 * Forwards to:
 *   - ad-manager
 *   - wachat-facebook-pages / facebook-content / facebook-messaging /
 *     facebook-comments / facebook-events / facebook-lead-gen
 *   - wachat-instagram
 *   - meta-suite
 *   - qr-codes
 *   - url-shortener
 *
 * SEO surface stays as the hand-written `/api/v1/seo/audit` and
 * `/api/v1/seo/report/pdf` routes — those Rust crates aren't yet stood
 * up. Promote into the manifest once the seo-* crates exist.
 */

import type { EndpointSpec } from '../types';
import { crudResource } from '../crud-template';

export const marketingEndpoints: ReadonlyArray<EndpointSpec> = [
  /* ── Ad Manager ───────────────────────────────────────────────────────── */
  ...crudResource({
    module: 'ad-manager',
    resource: 'campaigns',
    basePath: '/ad-manager/campaigns',
    rustPath: '/v1/ad-manager/campaigns',
    scopeRead: 'ads:read',
    scopeWrite: 'ads:write',
    emits: { create: 'ads.campaign.created' },
  }),
  ...crudResource({
    module: 'ad-manager',
    resource: 'ad-sets',
    basePath: '/ad-manager/ad-sets',
    rustPath: '/v1/ad-manager/ad-sets',
    scopeRead: 'ads:read',
    scopeWrite: 'ads:write',
    idParam: 'adSetId',
  }),
  ...crudResource({
    module: 'ad-manager',
    resource: 'ads',
    basePath: '/ad-manager/ads',
    rustPath: '/v1/ad-manager/ads',
    scopeRead: 'ads:read',
    scopeWrite: 'ads:write',
  }),
  ...crudResource({
    module: 'ad-manager',
    resource: 'audiences',
    basePath: '/ad-manager/audiences',
    rustPath: '/v1/ad-manager/audiences',
    scopeRead: 'ads:read',
    scopeWrite: 'ads:write',
  }),

  /* ── Facebook ─────────────────────────────────────────────────────────── */
  ...crudResource({
    module: 'facebook',
    resource: 'pages',
    basePath: '/facebook/pages',
    rustPath: '/v1/facebook/pages',
    scopeRead: 'facebook:read',
    scopeWrite: 'facebook:write',
    verbs: ['list', 'get'],
  }),
  ...crudResource({
    module: 'facebook',
    resource: 'posts',
    basePath: '/facebook/posts',
    rustPath: '/v1/facebook/content/posts',
    scopeRead: 'facebook:read',
    scopeWrite: 'facebook:write',
    emits: { create: 'facebook.post.created' },
  }),
  ...crudResource({
    module: 'facebook',
    resource: 'comments',
    basePath: '/facebook/comments',
    rustPath: '/v1/facebook/comments',
    scopeRead: 'facebook:read',
    scopeWrite: 'facebook:write',
    verbs: ['list', 'get', 'delete'],
  }),

  /* ── Instagram ────────────────────────────────────────────────────────── */
  ...crudResource({
    module: 'instagram',
    resource: 'posts',
    basePath: '/instagram/posts',
    rustPath: '/v1/instagram/posts',
    scopeRead: 'instagram:read',
    scopeWrite: 'instagram:write',
  }),
  ...crudResource({
    module: 'instagram',
    resource: 'accounts',
    basePath: '/instagram/accounts',
    rustPath: '/v1/instagram/accounts',
    scopeRead: 'instagram:read',
    scopeWrite: 'instagram:write',
    verbs: ['list', 'get'],
  }),

  /* ── Utilities ────────────────────────────────────────────────────────── */
  ...crudResource({
    module: 'qr-codes',
    resource: 'qr-codes',
    basePath: '/qr-codes',
    rustPath: '/v1/qr-codes',
    scopeRead: 'qr:read',
    scopeWrite: 'qr:write',
    idParam: 'qrCodeId',
    emits: { create: 'qr.code.created' },
  }),
  ...crudResource({
    module: 'url-shortener',
    resource: 'links',
    basePath: '/url-shortener/links',
    rustPath: '/v1/url-shortener',
    scopeRead: 'urls:read',
    scopeWrite: 'urls:write',
    emits: { create: 'urls.link.created' },
  }),
];
