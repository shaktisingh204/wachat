/**
 * Wachat surface beyond send + broadcast + templates.
 * Covers analytics, calling, pay, features, config, projects, webhook
 * inbound events, and webhook actions.
 */

import type { EndpointSpec } from '../types';
import { crudResource } from '../crud-template';

const generic2xx = { description: 'OK', schema: { type: 'object' as const } };
const auth = {
  '401': { description: 'Missing or invalid API key' },
  '429': { description: 'Rate limit exceeded' },
};

export const wachatExtrasEndpoints: ReadonlyArray<EndpointSpec> = [
  /* ── Projects ─────────────────────────────────────────────────────────── */
  ...crudResource({
    module: 'wachat',
    resource: 'projects',
    basePath: '/wachat/projects',
    rustPath: '/v1/projects',
    scopeRead: 'projects:read',
    scopeWrite: 'projects:write',
  }),

  /* ── Analytics ────────────────────────────────────────────────────────── */
  {
    module: 'wachat',
    resource: 'analytics',
    verb: 'list',
    path: '/wachat/analytics/summary',
    method: 'GET',
    scope: 'wachat:read',
    tier: 'FREE',
    summary: 'Aggregate WhatsApp messaging analytics',
    queryParams: [
      { name: 'from', schema: { type: 'string', format: 'date-time' } },
      { name: 'to', schema: { type: 'string', format: 'date-time' } },
      { name: 'projectId', schema: { type: 'string' } },
    ],
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/wachat/analytics/summary', method: 'GET' },
  },

  /* ── Calling ──────────────────────────────────────────────────────────── */
  {
    module: 'wachat',
    resource: 'calling',
    verb: 'custom',
    path: '/wachat/calling/initiate',
    method: 'POST',
    scope: 'wachat:write',
    tier: 'PRO',
    summary: 'Initiate a WhatsApp call',
    requestBody: { required: true, schema: { type: 'object' } },
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/wachat/calling/initiate', method: 'POST' },
    emits: ['wachat.call.initiated'],
  },
  {
    module: 'wachat',
    resource: 'calling',
    verb: 'list',
    path: '/wachat/calling',
    method: 'GET',
    scope: 'wachat:read',
    tier: 'FREE',
    summary: 'List WhatsApp calls',
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/wachat/calling', method: 'GET' },
  },

  /* ── Pay ──────────────────────────────────────────────────────────────── */
  {
    module: 'wachat',
    resource: 'pay',
    verb: 'custom',
    path: '/wachat/pay/request',
    method: 'POST',
    scope: 'wachat:write',
    tier: 'PRO',
    summary: 'Create a WhatsApp Pay request',
    requestBody: { required: true, schema: { type: 'object' } },
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/wachat/pay/request', method: 'POST' },
    emits: ['wachat.pay.requested'],
  },
  {
    module: 'wachat',
    resource: 'pay',
    verb: 'list',
    path: '/wachat/pay/transactions',
    method: 'GET',
    scope: 'wachat:read',
    tier: 'FREE',
    summary: 'List WhatsApp Pay transactions',
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/wachat/pay/transactions', method: 'GET' },
  },

  /* ── Features ─────────────────────────────────────────────────────────── */
  {
    module: 'wachat',
    resource: 'features',
    verb: 'list',
    path: '/wachat/features',
    method: 'GET',
    scope: 'wachat:read',
    tier: 'FREE',
    summary: 'List enabled Wachat features for the tenant',
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/wachat/features', method: 'GET' },
  },

  /* ── Config ───────────────────────────────────────────────────────────── */
  {
    module: 'wachat',
    resource: 'config',
    verb: 'get',
    path: '/wachat/config',
    method: 'GET',
    scope: 'wachat:read',
    tier: 'FREE',
    summary: 'Read the tenant\'s Wachat configuration',
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/wachat/config', method: 'GET' },
  },
  {
    module: 'wachat',
    resource: 'config',
    verb: 'update',
    path: '/wachat/config',
    method: 'PATCH',
    scope: 'wachat:write',
    tier: 'FREE',
    summary: 'Update the tenant\'s Wachat configuration',
    requestBody: { required: true, schema: { type: 'object' } },
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/wachat/config', method: 'PATCH' },
  },

  /* ── Flows (Wachat-bound, separate from SabFlow which is excluded) ────── */
  ...crudResource({
    module: 'wachat',
    resource: 'flows',
    basePath: '/wachat/flows',
    rustPath: '/v1/flows',
    scopeRead: 'wachat:read',
    scopeWrite: 'wachat:write',
  }),
];
