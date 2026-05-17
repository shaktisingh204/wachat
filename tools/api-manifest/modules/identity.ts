/**
 * Identity module — the smallest possible endpoint set, used as the Phase 0
 * proving ground for the codegen. Today this covers:
 *
 *   GET /me          — identify the calling tenant
 *
 * `/api/v1` (discovery) and `/api/v1/openapi` are NOT in the manifest by
 * design: they are unauthenticated, hand-written, and exist before the
 * platform plumbing runs. Including them would force the generator to
 * special-case unauthenticated routes for one endpoint each — not worth it.
 */

import type { EndpointSpec } from '../types';

export const identityEndpoints: ReadonlyArray<EndpointSpec> = [
  {
    module: 'identity',
    resource: 'me',
    verb: 'get',
    path: '/me',
    method: 'GET',
    scope: 'me:read',
    tier: 'FREE',
    summary: 'Identify the calling tenant',
    description:
      'Returns the authenticated tenant id, granted scopes, and rate-limit tier ' +
      'for the API key in use. Cheap; safe to call as a connectivity probe.',
    responses: {
      '2xx': {
        description: 'Caller info',
        schema: { $ref: '#/components/schemas/Me' },
      },
      '401': { description: 'Missing or invalid API key' },
      '429': { description: 'Rate limit exceeded' },
    },
    delegate: { kind: 'inline', name: 'me' },
  },
];
