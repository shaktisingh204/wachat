/**
 * API keys + Personal Access Tokens — self-service management endpoints.
 *
 * All endpoints below operate on the calling tenant's own records, so
 * they're guarded by `keys:read` / `keys:write` rather than admin scopes.
 * Listing returns redacted prefixes only; the plain key is shown exactly
 * once at creation time and never again.
 */

import type { EndpointSpec } from '../types';

export const keysEndpoints: ReadonlyArray<EndpointSpec> = [
  /* ── API keys ─────────────────────────────────────────────────────────── */
  {
    module: 'identity',
    resource: 'keys',
    verb: 'list',
    path: '/me/keys',
    method: 'GET',
    scope: 'keys:read',
    tier: 'FREE',
    summary: 'List the calling tenant’s API keys',
    responses: {
      '2xx': {
        description: 'A page of API keys (plain key never returned).',
        schema: { $ref: '#/components/schemas/ApiKeyList' },
      },
      '401': { description: 'Missing or invalid API key' },
      '429': { description: 'Rate limit exceeded' },
    },
    delegate: { kind: 'handler', export: 'listKeys', from: '@/lib/api-platform/handlers/identity' },
  },
  {
    module: 'identity',
    resource: 'keys',
    verb: 'create',
    path: '/me/keys',
    method: 'POST',
    scope: 'keys:write',
    tier: 'FREE',
    summary: 'Generate a new API key',
    description: 'The plain-text key is returned ONCE in the response. Persist it client-side immediately.',
    requestBody: {
      required: true,
      schema: { $ref: '#/components/schemas/ApiKeyCreate' },
    },
    responses: {
      '2xx': {
        description: 'Key created; plain-text shown once',
        schema: { $ref: '#/components/schemas/ApiKeyCreated' },
      },
      '400': { description: 'Invalid name or scopes' },
      '401': { description: 'Missing or invalid API key' },
      '429': { description: 'Rate limit exceeded' },
    },
    delegate: { kind: 'handler', export: 'createKey', from: '@/lib/api-platform/handlers/identity' },
    emits: ['identity.api_key.created'],
  },
  {
    module: 'identity',
    resource: 'keys',
    verb: 'delete',
    path: '/me/keys/[keyId]',
    method: 'DELETE',
    scope: 'keys:write',
    tier: 'FREE',
    summary: 'Revoke an API key',
    pathParams: [
      { name: 'keyId', schema: { type: 'string' }, description: 'Mongo id of the key.' },
    ],
    responses: {
      '2xx': { description: 'Revoked', schema: { $ref: '#/components/schemas/Acknowledged' } },
      '401': { description: 'Missing or invalid API key' },
      '404': { description: 'Key not found' },
      '429': { description: 'Rate limit exceeded' },
    },
    delegate: { kind: 'handler', export: 'revokeKey', from: '@/lib/api-platform/handlers/identity' },
    emits: ['identity.api_key.revoked'],
  },

  /* ── Personal Access Tokens ───────────────────────────────────────────── */
  {
    module: 'identity',
    resource: 'personal_tokens',
    verb: 'list',
    path: '/me/personal-tokens',
    method: 'GET',
    scope: 'keys:read',
    tier: 'FREE',
    summary: 'List Personal Access Tokens for the calling user',
    responses: {
      '2xx': {
        description: 'A page of PATs (plain token never returned).',
        schema: { $ref: '#/components/schemas/PatList' },
      },
      '401': { description: 'Missing or invalid API key' },
      '429': { description: 'Rate limit exceeded' },
    },
    delegate: { kind: 'handler', export: 'listPats', from: '@/lib/api-platform/handlers/identity' },
  },
  {
    module: 'identity',
    resource: 'personal_tokens',
    verb: 'create',
    path: '/me/personal-tokens',
    method: 'POST',
    scope: 'keys:write',
    tier: 'FREE',
    summary: 'Create a Personal Access Token',
    description: 'PATs are bound to the calling user and inherit their RBAC. The plain-text token is returned ONCE.',
    requestBody: { required: true, schema: { $ref: '#/components/schemas/PatCreate' } },
    responses: {
      '2xx': {
        description: 'PAT created; plain-text shown once',
        schema: { $ref: '#/components/schemas/PatCreated' },
      },
      '400': { description: 'Invalid name or scopes' },
      '401': { description: 'Missing or invalid API key' },
      '429': { description: 'Rate limit exceeded' },
    },
    delegate: { kind: 'handler', export: 'createPat', from: '@/lib/api-platform/handlers/identity' },
    emits: ['identity.pat.created'],
  },
  {
    module: 'identity',
    resource: 'personal_tokens',
    verb: 'delete',
    path: '/me/personal-tokens/[tokenId]',
    method: 'DELETE',
    scope: 'keys:write',
    tier: 'FREE',
    summary: 'Revoke a Personal Access Token',
    pathParams: [
      { name: 'tokenId', schema: { type: 'string' }, description: 'Mongo id of the token.' },
    ],
    responses: {
      '2xx': { description: 'Revoked', schema: { $ref: '#/components/schemas/Acknowledged' } },
      '401': { description: 'Missing or invalid API key' },
      '404': { description: 'Token not found' },
      '429': { description: 'Rate limit exceeded' },
    },
    delegate: { kind: 'handler', export: 'revokePat', from: '@/lib/api-platform/handlers/identity' },
    emits: ['identity.pat.revoked'],
  },
];
