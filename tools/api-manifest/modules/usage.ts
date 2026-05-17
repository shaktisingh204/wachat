/**
 * Usage analytics + request-log explorer endpoints.
 *
 * Reads from `apiRequestLog` (Mongo) via the `developer-api-usage` Rust
 * crate. Writes come from the Next.js `withApiV1` wrapper.
 */

import type { EndpointSpec } from '../types';

const generic2xx = { description: 'OK', schema: { type: 'object' as const } };
const auth = {
  '401': { description: 'Missing or invalid API key' },
  '429': { description: 'Rate limit exceeded' },
};

export const usageEndpoints: ReadonlyArray<EndpointSpec> = [
  {
    module: 'usage',
    resource: 'summary',
    verb: 'get',
    path: '/usage/summary',
    method: 'GET',
    scope: 'billing:read',
    tier: 'FREE',
    summary: 'Per-tenant request counters + latency over a time window',
    queryParams: [
      { name: 'from', schema: { type: 'string', format: 'date-time' }, description: 'ISO-8601 lower bound. Defaults to now-24h.' },
      { name: 'to', schema: { type: 'string', format: 'date-time' }, description: 'ISO-8601 upper bound. Defaults to now.' },
    ],
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/usage/summary', method: 'GET' },
  },
  {
    module: 'usage',
    resource: 'top',
    verb: 'list',
    path: '/usage/top',
    method: 'GET',
    scope: 'billing:read',
    tier: 'FREE',
    summary: 'Top endpoints by request count',
    queryParams: [
      { name: 'from', schema: { type: 'string', format: 'date-time' } },
      { name: 'to', schema: { type: 'string', format: 'date-time' } },
      { name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
    ],
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/usage/top', method: 'GET' },
  },
  {
    module: 'usage',
    resource: 'by-key',
    verb: 'list',
    path: '/usage/by-key',
    method: 'GET',
    scope: 'billing:read',
    tier: 'FREE',
    summary: 'Per-key request counters',
    queryParams: [
      { name: 'from', schema: { type: 'string', format: 'date-time' } },
      { name: 'to', schema: { type: 'string', format: 'date-time' } },
    ],
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/usage/by-key', method: 'GET' },
  },
  {
    module: 'usage',
    resource: 'logs',
    verb: 'list',
    path: '/usage/logs',
    method: 'GET',
    scope: 'billing:read',
    tier: 'FREE',
    summary: 'Cursor-paginated raw request log',
    queryParams: [
      { name: 'from', schema: { type: 'string', format: 'date-time' } },
      { name: 'to', schema: { type: 'string', format: 'date-time' } },
      { name: 'keyId', schema: { type: 'string' } },
      { name: 'path', schema: { type: 'string' } },
      { name: 'minStatus', schema: { type: 'integer' }, description: 'Filter to status >= this value.' },
      { name: 'cursor', schema: { type: 'string' } },
      { name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
    ],
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/usage/logs', method: 'GET' },
  },
];
