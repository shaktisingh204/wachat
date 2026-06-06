/**
 * Wachat completion surface — NEW routes shipped on existing, finished Rust
 * crates that were not yet on the public `/api/v1` developer API.
 *
 * Every endpoint is a pure `rust-fwd` passthrough (forwarded as the
 * authenticated user via `rustFetchAsUser`), mirroring `wachat-extras.ts`.
 * The manifest exists so developers get OpenAPI + a stable public namespace
 * independent of the Rust route layout. Crates covered:
 *
 *   - wachat-flows              (mounted at /v1/flows)
 *   - wachat-analytics          (mounted at /v1/wachat/analytics)
 *   - wachat-features           (mounted at /v1/wachat/features)
 *   - wachat-config             (mounted at /v1/wachat/config)
 *   - wachat-templates-actions  (mounted at /v1/wachat/templates-actions)
 *   - wachat-contacts           (mounted at /v1/contacts)
 *
 * Public paths mirror the existing exposure of each domain:
 *   - flows    → public /wachat/flows/*   rust /v1/flows/*      (see wachat-extras)
 *   - contacts → public /wachat/contacts/* rust /v1/contacts/*  (kanban surface)
 *   - the /v1/wachat/* crates keep their path minus the leading /v1.
 */

import type { EndpointSpec } from '../types';

const generic2xx = { description: 'OK', schema: { type: 'object' as const } };
const auth = {
  '401': { description: 'Missing or invalid API key' },
  '429': { description: 'Rate limit exceeded' },
};

export const wachatCompletionExtendedEndpoints: ReadonlyArray<EndpointSpec> = [
  /* ── wachat-flows (mounted /v1/flows) ─────────────────────────────────── */
  {
    module: 'wachat',
    resource: 'flows',
    verb: 'custom',
    path: '/wachat/flows/[id]/clone',
    method: 'POST',
    scope: 'wachat:write',
    tier: 'FREE',
    summary: 'Clone a Wachat flow',
    pathParams: [{ name: 'id', schema: { type: 'string' } }],
    requestBody: { required: false, schema: { type: 'object' } },
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/flows/{id}/clone', method: 'POST' },
  },
  {
    module: 'wachat',
    resource: 'flows',
    verb: 'custom',
    path: '/wachat/flows/bulk-delete',
    method: 'DELETE',
    scope: 'wachat:write',
    tier: 'PRO',
    summary: 'Bulk-delete Wachat flows',
    // NOTE: the {flowIds} body is forwarded verbatim by the rust-fwd proxy; the
    // manifest omits a requestBody decl because the linter forbids it on DELETE.
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/flows/bulk-delete', method: 'DELETE' },
  },
  {
    module: 'wachat',
    resource: 'flows',
    verb: 'custom',
    path: '/wachat/flows/bulk-status',
    method: 'PATCH',
    scope: 'wachat:write',
    tier: 'FREE',
    summary: 'Bulk-update Wachat flow status',
    requestBody: { required: true, schema: { type: 'object' } },
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/flows/bulk-status', method: 'PATCH' },
  },

  /* ── wachat-analytics (mounted /v1/wachat/analytics) ──────────────────── */
  {
    module: 'wachat',
    resource: 'analytics',
    verb: 'get',
    path: '/wachat/analytics/projects/[id]/dashboard-summary',
    method: 'GET',
    scope: 'wachat:read',
    tier: 'FREE',
    summary: 'Single-call analytics dashboard overview for a project',
    pathParams: [{ name: 'id', schema: { type: 'string' } }],
    responses: { '2xx': generic2xx, ...auth },
    delegate: {
      kind: 'rust-fwd',
      path: '/v1/wachat/analytics/projects/{id}/dashboard-summary',
      method: 'GET',
    },
  },
  {
    module: 'wachat',
    resource: 'analytics',
    verb: 'get',
    path: '/wachat/analytics/projects/[id]/agent-performance',
    method: 'GET',
    scope: 'wachat:read',
    tier: 'FREE',
    summary: 'Per-agent performance leaderboard for a project',
    pathParams: [{ name: 'id', schema: { type: 'string' } }],
    queryParams: [{ name: 'days', schema: { type: 'integer' } }],
    responses: { '2xx': generic2xx, ...auth },
    delegate: {
      kind: 'rust-fwd',
      path: '/v1/wachat/analytics/projects/{id}/agent-performance',
      method: 'GET',
    },
  },
  {
    module: 'wachat',
    resource: 'analytics',
    verb: 'get',
    path: '/wachat/analytics/projects/[id]/agents/[agentId]/hourly',
    method: 'GET',
    scope: 'wachat:read',
    tier: 'FREE',
    summary: 'Hourly activity breakdown for a single agent',
    pathParams: [
      { name: 'id', schema: { type: 'string' } },
      { name: 'agentId', schema: { type: 'string' } },
    ],
    responses: { '2xx': generic2xx, ...auth },
    delegate: {
      kind: 'rust-fwd',
      path: '/v1/wachat/analytics/projects/{id}/agents/{agentId}/hourly',
      method: 'GET',
    },
  },

  /* ── wachat-features (mounted /v1/wachat/features) ────────────────────── */
  {
    module: 'wachat',
    resource: 'features',
    verb: 'update',
    path: '/wachat/features/message-tags/[tagId]',
    method: 'PATCH',
    scope: 'wachat:write',
    tier: 'FREE',
    summary: 'Update a message tag',
    pathParams: [{ name: 'tagId', schema: { type: 'string' } }],
    requestBody: { required: true, schema: { type: 'object' } },
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/wachat/features/message-tags/{tagId}', method: 'PATCH' },
  },
  {
    module: 'wachat',
    resource: 'features',
    verb: 'custom',
    path: '/wachat/features/projects/[id]/message-tags/bulk-apply',
    method: 'POST',
    scope: 'wachat:write',
    tier: 'FREE',
    summary: 'Bulk-apply a message tag to conversations',
    pathParams: [{ name: 'id', schema: { type: 'string' } }],
    requestBody: { required: true, schema: { type: 'object' } },
    responses: { '2xx': generic2xx, ...auth },
    delegate: {
      kind: 'rust-fwd',
      path: '/v1/wachat/features/projects/{id}/message-tags/bulk-apply',
      method: 'POST',
    },
  },
  {
    module: 'wachat',
    resource: 'features',
    verb: 'get',
    path: '/wachat/features/projects/[id]/message-tags/[tagId]/analytics',
    method: 'GET',
    scope: 'wachat:read',
    tier: 'FREE',
    summary: 'Analytics for a single message tag',
    pathParams: [
      { name: 'id', schema: { type: 'string' } },
      { name: 'tagId', schema: { type: 'string' } },
    ],
    responses: { '2xx': generic2xx, ...auth },
    delegate: {
      kind: 'rust-fwd',
      path: '/v1/wachat/features/projects/{id}/message-tags/{tagId}/analytics',
      method: 'GET',
    },
  },
  {
    module: 'wachat',
    resource: 'features',
    verb: 'list',
    path: '/wachat/features/projects/[id]/scheduled-reports',
    method: 'GET',
    scope: 'wachat:read',
    tier: 'FREE',
    summary: 'List scheduled analytics reports for a project',
    pathParams: [{ name: 'id', schema: { type: 'string' } }],
    responses: { '2xx': generic2xx, ...auth },
    delegate: {
      kind: 'rust-fwd',
      path: '/v1/wachat/features/projects/{id}/scheduled-reports',
      method: 'GET',
    },
  },
  {
    module: 'wachat',
    resource: 'features',
    verb: 'create',
    path: '/wachat/features/projects/[id]/scheduled-reports',
    method: 'POST',
    scope: 'wachat:write',
    tier: 'FREE',
    summary: 'Create a scheduled analytics report for a project',
    pathParams: [{ name: 'id', schema: { type: 'string' } }],
    requestBody: { required: true, schema: { type: 'object' } },
    responses: { '2xx': generic2xx, ...auth },
    delegate: {
      kind: 'rust-fwd',
      path: '/v1/wachat/features/projects/{id}/scheduled-reports',
      method: 'POST',
    },
  },
  {
    module: 'wachat',
    resource: 'features',
    verb: 'delete',
    path: '/wachat/features/scheduled-reports/[reportId]',
    method: 'DELETE',
    scope: 'wachat:write',
    tier: 'FREE',
    summary: 'Delete a scheduled analytics report',
    pathParams: [{ name: 'reportId', schema: { type: 'string' } }],
    responses: { '2xx': generic2xx, ...auth },
    delegate: {
      kind: 'rust-fwd',
      path: '/v1/wachat/features/scheduled-reports/{reportId}',
      method: 'DELETE',
    },
  },
  {
    module: 'wachat',
    resource: 'features',
    verb: 'delete',
    path: '/wachat/features/projects/[id]/analytics/link-clicks',
    method: 'DELETE',
    scope: 'wachat:write',
    tier: 'FREE',
    summary: 'Clear recorded link-click analytics for a project',
    pathParams: [{ name: 'id', schema: { type: 'string' } }],
    responses: { '2xx': generic2xx, ...auth },
    delegate: {
      kind: 'rust-fwd',
      path: '/v1/wachat/features/projects/{id}/analytics/link-clicks',
      method: 'DELETE',
    },
  },

  /* ── wachat-config (mounted /v1/wachat/config) ────────────────────────── */
  {
    module: 'wachat',
    resource: 'config',
    verb: 'custom',
    path: '/wachat/config/projects/[id]/phone-numbers/[pnid]/display-name',
    method: 'POST',
    scope: 'wachat:write',
    tier: 'FREE',
    summary: 'Request a phone-number display-name change',
    pathParams: [
      { name: 'id', schema: { type: 'string' } },
      { name: 'pnid', schema: { type: 'string' } },
    ],
    requestBody: { required: true, schema: { type: 'object' } },
    responses: { '2xx': generic2xx, ...auth },
    delegate: {
      kind: 'rust-fwd',
      path: '/v1/wachat/config/projects/{id}/phone-numbers/{pnid}/display-name',
      method: 'POST',
    },
  },
  {
    module: 'wachat',
    resource: 'config',
    verb: 'get',
    path: '/wachat/config/projects/[id]/phone-numbers/[pnid]/display-name/status',
    method: 'GET',
    scope: 'wachat:read',
    tier: 'FREE',
    summary: 'Read the status of a display-name change request',
    pathParams: [
      { name: 'id', schema: { type: 'string' } },
      { name: 'pnid', schema: { type: 'string' } },
    ],
    responses: { '2xx': generic2xx, ...auth },
    delegate: {
      kind: 'rust-fwd',
      path: '/v1/wachat/config/projects/{id}/phone-numbers/{pnid}/display-name/status',
      method: 'GET',
    },
  },
  {
    module: 'wachat',
    resource: 'config',
    verb: 'custom',
    path: '/wachat/config/projects/[id]/phone-numbers/[pnid]/flows-encryption/generate',
    method: 'POST',
    scope: 'wachat:write',
    tier: 'PRO',
    summary: 'Generate a WhatsApp Flows encryption key pair',
    pathParams: [
      { name: 'id', schema: { type: 'string' } },
      { name: 'pnid', schema: { type: 'string' } },
    ],
    requestBody: { required: false, schema: { type: 'object' } },
    responses: { '2xx': generic2xx, ...auth },
    delegate: {
      kind: 'rust-fwd',
      path: '/v1/wachat/config/projects/{id}/phone-numbers/{pnid}/flows-encryption/generate',
      method: 'POST',
    },
  },
  {
    module: 'wachat',
    resource: 'config',
    verb: 'custom',
    path: '/wachat/config/projects/[id]/phone-numbers/[pnid]/flows-encryption/upload',
    method: 'POST',
    scope: 'wachat:write',
    tier: 'PRO',
    summary: 'Upload the WhatsApp Flows public encryption key to Meta',
    pathParams: [
      { name: 'id', schema: { type: 'string' } },
      { name: 'pnid', schema: { type: 'string' } },
    ],
    requestBody: { required: false, schema: { type: 'object' } },
    responses: { '2xx': generic2xx, ...auth },
    delegate: {
      kind: 'rust-fwd',
      path: '/v1/wachat/config/projects/{id}/phone-numbers/{pnid}/flows-encryption/upload',
      method: 'POST',
    },
  },

  /* ── wachat-templates-actions (mounted /v1/wachat/templates-actions) ──── */
  {
    module: 'wachat',
    resource: 'templates-actions',
    verb: 'custom',
    path: '/wachat/templates-actions/multilang/clone',
    method: 'POST',
    scope: 'templates:write',
    tier: 'FREE',
    summary: 'Clone a template into additional languages',
    requestBody: { required: true, schema: { type: 'object' } },
    responses: { '2xx': generic2xx, ...auth },
    delegate: {
      kind: 'rust-fwd',
      path: '/v1/wachat/templates-actions/multilang/clone',
      method: 'POST',
    },
  },

  /* ── wachat-contacts (mounted /v1/contacts) — kanban surface ──────────── */
  {
    module: 'wachat',
    resource: 'contacts',
    verb: 'list',
    path: '/wachat/contacts/kanban',
    method: 'GET',
    scope: 'contacts:read',
    tier: 'FREE',
    summary: 'Read the contacts kanban board',
    queryParams: [{ name: 'projectId', schema: { type: 'string' } }],
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/contacts/kanban', method: 'GET' },
  },
  {
    module: 'wachat',
    resource: 'contacts',
    verb: 'custom',
    path: '/wachat/contacts/kanban/statuses',
    method: 'POST',
    scope: 'contacts:write',
    tier: 'FREE',
    summary: 'Save the ordered kanban status columns',
    requestBody: { required: true, schema: { type: 'object' } },
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/contacts/kanban/statuses', method: 'POST' },
  },
];
