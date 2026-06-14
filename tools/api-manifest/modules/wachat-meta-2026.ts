/**
 * WaChat 2026 Meta capabilities — MM Lite (marketing), carousels, interactive
 * (CTA-URL / location-request / passthrough), BSUID identity, and Calling
 * webhook call-log.
 *
 * Every endpoint is a thin `rust-fwd` passthrough to the new Phase-0D crates
 * (`wachat-marketing` / `wachat-carousel` / `wachat-identity` /
 * `wachat-interactive` / `wachat-webhook-calls`), mounted by the API crate at
 * `/v1/wachat/{marketing,carousel,identity,interactive,webhook-calls}`.
 *
 * NOTE: the public `path` uses Next.js dynamic-segment syntax `[id]` (→ route
 * folder), while `delegate.path` uses `{id}` (substituted into the Rust-forward
 * template).
 */

import type { EndpointSpec } from '../types';

const ack = {
  '2xx': { description: 'OK' },
  '400': { description: 'Validation failed' },
  '401': { description: 'Missing or invalid API key' },
  '403': { description: 'Missing required scope' },
  '404': { description: 'Project not found' },
  '429': { description: 'Rate limit exceeded' },
} as const;

export const wachatMeta2026Endpoints: ReadonlyArray<EndpointSpec> = [
  /* ── MM Lite / Marketing Messages ─────────────────────────────────────── */
  {
    module: 'wachat',
    resource: 'marketing',
    verb: 'custom',
    path: '/wachat/marketing/projects/[id]/send',
    method: 'POST',
    scope: 'wachat:write',
    tier: 'FREE',
    summary: 'Send a marketing (MM Lite) template message',
    requestBody: { required: true, schema: { type: 'object' } },
    pathParams: [{ name: 'id', schema: { type: 'string' } }],
    responses: ack,
    delegate: { kind: 'rust-fwd', path: '/v1/wachat/marketing/projects/{id}/send', method: 'POST' },
    credits: 1,
  },
  {
    module: 'wachat',
    resource: 'marketing',
    verb: 'custom',
    path: '/wachat/marketing/projects/[id]/campaigns',
    method: 'GET',
    scope: 'wachat:read',
    tier: 'FREE',
    summary: 'List marketing campaign sends',
    pathParams: [{ name: 'id', schema: { type: 'string' } }],
    responses: ack,
    delegate: { kind: 'rust-fwd', path: '/v1/wachat/marketing/projects/{id}/campaigns', method: 'GET' },
  },

  /* ── Carousels ────────────────────────────────────────────────────────── */
  {
    module: 'wachat',
    resource: 'carousel',
    verb: 'custom',
    path: '/wachat/carousel/projects/[id]/templates',
    method: 'POST',
    scope: 'wachat:write',
    tier: 'FREE',
    summary: 'Create a carousel template on the WABA',
    requestBody: { required: true, schema: { type: 'object' } },
    pathParams: [{ name: 'id', schema: { type: 'string' } }],
    responses: ack,
    delegate: { kind: 'rust-fwd', path: '/v1/wachat/carousel/projects/{id}/templates', method: 'POST' },
  },
  {
    module: 'wachat',
    resource: 'carousel',
    verb: 'custom',
    path: '/wachat/carousel/projects/[id]/send',
    method: 'POST',
    scope: 'wachat:write',
    tier: 'FREE',
    summary: 'Send a carousel template message',
    requestBody: { required: true, schema: { type: 'object' } },
    pathParams: [{ name: 'id', schema: { type: 'string' } }],
    responses: ack,
    delegate: { kind: 'rust-fwd', path: '/v1/wachat/carousel/projects/{id}/send', method: 'POST' },
    credits: 1,
  },
  {
    module: 'wachat',
    resource: 'carousel',
    verb: 'custom',
    path: '/wachat/carousel/projects/[id]/sent',
    method: 'GET',
    scope: 'wachat:read',
    tier: 'FREE',
    summary: 'List sent carousels',
    pathParams: [{ name: 'id', schema: { type: 'string' } }],
    responses: ack,
    delegate: { kind: 'rust-fwd', path: '/v1/wachat/carousel/projects/{id}/sent', method: 'GET' },
  },

  /* ── BSUID identity ───────────────────────────────────────────────────── */
  {
    module: 'wachat',
    resource: 'identity',
    verb: 'custom',
    path: '/wachat/identity/projects/[id]/resolve',
    method: 'POST',
    scope: 'contacts:write',
    tier: 'FREE',
    summary: 'Resolve (or create) a contact by BSUID or phone',
    requestBody: { required: true, schema: { type: 'object' } },
    pathParams: [{ name: 'id', schema: { type: 'string' } }],
    responses: ack,
    delegate: { kind: 'rust-fwd', path: '/v1/wachat/identity/projects/{id}/resolve', method: 'POST' },
  },

  /* ── Interactive (CTA-URL / location-request / passthrough) ───────────── */
  {
    module: 'wachat',
    resource: 'interactive',
    verb: 'custom',
    path: '/wachat/interactive/projects/[id]/cta-url',
    method: 'POST',
    scope: 'wachat:write',
    tier: 'FREE',
    summary: 'Send a CTA-URL button message',
    requestBody: { required: true, schema: { type: 'object' } },
    pathParams: [{ name: 'id', schema: { type: 'string' } }],
    responses: ack,
    delegate: { kind: 'rust-fwd', path: '/v1/wachat/interactive/projects/{id}/cta-url', method: 'POST' },
    credits: 1,
  },
  {
    module: 'wachat',
    resource: 'interactive',
    verb: 'custom',
    path: '/wachat/interactive/projects/[id]/location-request',
    method: 'POST',
    scope: 'wachat:write',
    tier: 'FREE',
    summary: 'Send a location-request message',
    requestBody: { required: true, schema: { type: 'object' } },
    pathParams: [{ name: 'id', schema: { type: 'string' } }],
    responses: ack,
    delegate: {
      kind: 'rust-fwd',
      path: '/v1/wachat/interactive/projects/{id}/location-request',
      method: 'POST',
    },
    credits: 1,
  },
  {
    module: 'wachat',
    resource: 'interactive',
    verb: 'custom',
    path: '/wachat/interactive/projects/[id]/send',
    method: 'POST',
    scope: 'wachat:write',
    tier: 'FREE',
    summary: 'Send an interactive message (list/button/flow/webview passthrough)',
    requestBody: { required: true, schema: { type: 'object' } },
    pathParams: [{ name: 'id', schema: { type: 'string' } }],
    responses: ack,
    delegate: { kind: 'rust-fwd', path: '/v1/wachat/interactive/projects/{id}/send', method: 'POST' },
    credits: 1,
  },

  /* ── Calling webhook call-log ─────────────────────────────────────────── */
  {
    module: 'wachat',
    resource: 'webhook-calls',
    verb: 'custom',
    path: '/wachat/webhook-calls/projects/[id]/calls',
    method: 'GET',
    scope: 'wachat:read',
    tier: 'FREE',
    summary: 'List WhatsApp call events',
    pathParams: [{ name: 'id', schema: { type: 'string' } }],
    responses: ack,
    delegate: { kind: 'rust-fwd', path: '/v1/wachat/webhook-calls/projects/{id}/calls', method: 'GET' },
  },
];
