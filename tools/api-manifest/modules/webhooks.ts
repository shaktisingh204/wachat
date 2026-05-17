/**
 * Webhook control plane — subscriptions + delivery log.
 *
 * Forwards to the `developer-webhooks` Rust crate. The data plane (signing
 * + dispatch) lives in the Node `webhook-worker` process; both share the
 * `webhook_subscriptions` and `webhook_deliveries` Mongo collections.
 */

import type { EndpointSpec } from '../types';

const generic2xx = { description: 'OK', schema: { type: 'object' as const } };
const auth = {
  '401': { description: 'Missing or invalid API key' },
  '429': { description: 'Rate limit exceeded' },
};

export const webhooksEndpoints: ReadonlyArray<EndpointSpec> = [
  {
    module: 'webhooks',
    resource: 'subscriptions',
    verb: 'list',
    path: '/webhooks/subscriptions',
    method: 'GET',
    scope: 'webhooks:read',
    tier: 'FREE',
    summary: 'List webhook subscriptions',
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/developer-webhooks/subscriptions', method: 'GET' },
  },
  {
    module: 'webhooks',
    resource: 'subscriptions',
    verb: 'create',
    path: '/webhooks/subscriptions',
    method: 'POST',
    scope: 'webhooks:write',
    tier: 'FREE',
    summary: 'Create a webhook subscription',
    description: 'The signing secret is returned exactly once in the response. Store it client-side immediately.',
    requestBody: {
      required: true,
      schema: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', format: 'uri' },
          events: { type: 'array', items: { type: 'string' } },
          description: { type: 'string' },
        },
      },
    },
    responses: {
      '2xx': { description: 'Created (secret shown once)', schema: { type: 'object' } },
      '400': { description: 'Validation failed' },
      ...auth,
    },
    delegate: { kind: 'rust-fwd', path: '/v1/developer-webhooks/subscriptions', method: 'POST' },
    emits: ['webhooks.subscription.created'],
  },
  {
    module: 'webhooks',
    resource: 'subscriptions',
    verb: 'get',
    path: '/webhooks/subscriptions/[subId]',
    method: 'GET',
    scope: 'webhooks:read',
    tier: 'FREE',
    summary: 'Fetch a subscription',
    pathParams: [{ name: 'subId', schema: { type: 'string' } }],
    responses: { '2xx': generic2xx, '404': { description: 'Not found' }, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/developer-webhooks/subscriptions/{subId}', method: 'GET' },
  },
  {
    module: 'webhooks',
    resource: 'subscriptions',
    verb: 'update',
    path: '/webhooks/subscriptions/[subId]',
    method: 'PATCH',
    scope: 'webhooks:write',
    tier: 'FREE',
    summary: 'Update url / events / status',
    pathParams: [{ name: 'subId', schema: { type: 'string' } }],
    requestBody: { required: true, schema: { type: 'object' } },
    responses: { '2xx': generic2xx, '404': { description: 'Not found' }, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/developer-webhooks/subscriptions/{subId}', method: 'PATCH' },
  },
  {
    module: 'webhooks',
    resource: 'subscriptions',
    verb: 'delete',
    path: '/webhooks/subscriptions/[subId]',
    method: 'DELETE',
    scope: 'webhooks:write',
    tier: 'FREE',
    summary: 'Delete a subscription',
    pathParams: [{ name: 'subId', schema: { type: 'string' } }],
    responses: { '2xx': generic2xx, '404': { description: 'Not found' }, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/developer-webhooks/subscriptions/{subId}', method: 'DELETE' },
    emits: ['webhooks.subscription.deleted'],
  },
  {
    module: 'webhooks',
    resource: 'subscriptions',
    verb: 'custom',
    path: '/webhooks/subscriptions/[subId]/test',
    method: 'POST',
    scope: 'webhooks:write',
    tier: 'FREE',
    summary: 'Enqueue a synthetic test delivery to verify the receiver',
    pathParams: [{ name: 'subId', schema: { type: 'string' } }],
    responses: { '2xx': generic2xx, '404': { description: 'Not found' }, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/developer-webhooks/subscriptions/{subId}/test', method: 'POST' },
  },
  {
    module: 'webhooks',
    resource: 'deliveries',
    verb: 'list',
    path: '/webhooks/deliveries',
    method: 'GET',
    scope: 'webhooks:read',
    tier: 'FREE',
    summary: 'List recent deliveries',
    queryParams: [
      { name: 'subscriptionId', schema: { type: 'string' }, description: 'Filter to one subscription' },
      { name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
    ],
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/developer-webhooks/deliveries', method: 'GET' },
  },
  {
    module: 'webhooks',
    resource: 'deliveries',
    verb: 'custom',
    path: '/webhooks/deliveries/[deliveryId]/retry',
    method: 'POST',
    scope: 'webhooks:write',
    tier: 'FREE',
    summary: 'Reset a failed delivery for another attempt',
    pathParams: [{ name: 'deliveryId', schema: { type: 'string' } }],
    responses: { '2xx': generic2xx, '404': { description: 'Not found' }, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/developer-webhooks/deliveries/{deliveryId}/retry', method: 'POST' },
  },
];
