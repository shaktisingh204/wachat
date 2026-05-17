/**
 * OAuth app registration (developer-authenticated). Forwards to the
 * `developer-oauth` Rust crate at `/v1/oauth/apps/*`.
 *
 * The token endpoint, authorize endpoint, revoke, and introspect are
 * NOT in this manifest — they are hand-written under
 * `src/app/api/v1/oauth/{token,revoke,introspect}/route.ts` because they
 * must be publicly accessible (no API-key gate).
 */

import type { EndpointSpec } from '../types';

const auth = {
  '401': { description: 'Missing or invalid API key' },
  '429': { description: 'Rate limit exceeded' },
};

export const oauthAppsEndpoints: ReadonlyArray<EndpointSpec> = [
  {
    module: 'oauth',
    resource: 'apps',
    verb: 'list',
    path: '/oauth/apps',
    method: 'GET',
    scope: 'oauth:apps:read',
    tier: 'FREE',
    summary: 'List OAuth apps owned by the calling developer',
    responses: { '2xx': { description: 'Apps', schema: { type: 'object' } }, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/oauth/apps', method: 'GET' },
  },
  {
    module: 'oauth',
    resource: 'apps',
    verb: 'create',
    path: '/oauth/apps',
    method: 'POST',
    scope: 'oauth:apps:write',
    tier: 'FREE',
    summary: 'Register a new OAuth app (returns client_secret once)',
    requestBody: {
      required: true,
      schema: {
        type: 'object',
        required: ['name', 'redirectUris', 'scopes'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          redirectUris: { type: 'array', items: { type: 'string', format: 'uri' } },
          scopes: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    responses: {
      '2xx': { description: 'Created (client_secret shown once)', schema: { type: 'object' } },
      '400': { description: 'Validation failed' },
      ...auth,
    },
    delegate: { kind: 'rust-fwd', path: '/v1/oauth/apps', method: 'POST' },
    emits: ['oauth.app.created'],
  },
  {
    module: 'oauth',
    resource: 'apps',
    verb: 'delete',
    path: '/oauth/apps/[appId]',
    method: 'DELETE',
    scope: 'oauth:apps:write',
    tier: 'FREE',
    summary: 'Delete an OAuth app + cascade revoke its tokens',
    pathParams: [{ name: 'appId', schema: { type: 'string' } }],
    responses: {
      '2xx': { description: 'Deleted', schema: { type: 'object' } },
      '404': { description: 'Not found' },
      ...auth,
    },
    delegate: { kind: 'rust-fwd', path: '/v1/oauth/apps/{appId}', method: 'DELETE' },
    emits: ['oauth.app.deleted'],
  },
];
