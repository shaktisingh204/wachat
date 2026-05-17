/**
 * Telegram bot surface. Forwards to telegram-bots, telegram-broadcasts,
 * telegram-channels, and telegram-chats Rust crates.
 */

import type { EndpointSpec } from '../types';

const standard2xx = { description: 'OK', schema: { type: 'object' as const } };
const auth = {
  '401': { description: 'Missing or invalid API key' },
  '429': { description: 'Rate limit exceeded' },
};

export const telegramEndpoints: ReadonlyArray<EndpointSpec> = [
  /* ── Bots ─────────────────────────────────────────────────────────────── */
  {
    module: 'telegram',
    resource: 'bots',
    verb: 'list',
    path: '/telegram/bots',
    method: 'GET',
    scope: 'telegram:read',
    tier: 'FREE',
    summary: 'List Telegram bots connected to the tenant',
    responses: { '2xx': standard2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/telegram/bots', method: 'GET' },
  },
  {
    module: 'telegram',
    resource: 'bots',
    verb: 'get',
    path: '/telegram/bots/[botId]/info',
    method: 'GET',
    scope: 'telegram:read',
    tier: 'FREE',
    summary: 'Fetch bot info',
    pathParams: [{ name: 'botId', schema: { type: 'string' } }],
    responses: { '2xx': standard2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/telegram/bots/{botId}/info', method: 'GET' },
  },
  {
    module: 'telegram',
    resource: 'bots',
    verb: 'custom',
    path: '/telegram/bots/[botId]/name',
    method: 'POST',
    scope: 'telegram:write',
    tier: 'FREE',
    summary: 'Set bot display name',
    pathParams: [{ name: 'botId', schema: { type: 'string' } }],
    requestBody: { required: true, schema: { type: 'object' } },
    responses: { '2xx': standard2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/telegram/bots/{botId}/name', method: 'POST' },
  },
  {
    module: 'telegram',
    resource: 'bots',
    verb: 'custom',
    path: '/telegram/bots/[botId]/description',
    method: 'POST',
    scope: 'telegram:write',
    tier: 'FREE',
    summary: 'Set bot description',
    pathParams: [{ name: 'botId', schema: { type: 'string' } }],
    requestBody: { required: true, schema: { type: 'object' } },
    responses: { '2xx': standard2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/telegram/bots/{botId}/description', method: 'POST' },
  },
  {
    module: 'telegram',
    resource: 'bots',
    verb: 'custom',
    path: '/telegram/bots/[botId]/health',
    method: 'POST',
    scope: 'telegram:read',
    tier: 'FREE',
    summary: 'Run a health check against the Telegram BotAPI',
    pathParams: [{ name: 'botId', schema: { type: 'string' } }],
    responses: { '2xx': standard2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/telegram/bots/{botId}/health', method: 'POST' },
  },

  /* ── Broadcasts ───────────────────────────────────────────────────────── */
  {
    module: 'telegram',
    resource: 'broadcasts',
    verb: 'list',
    path: '/telegram/broadcasts',
    method: 'GET',
    scope: 'telegram:read',
    tier: 'FREE',
    summary: 'List Telegram broadcasts',
    responses: { '2xx': standard2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/telegram/broadcasts', method: 'GET' },
  },
  {
    module: 'telegram',
    resource: 'broadcasts',
    verb: 'create',
    path: '/telegram/broadcasts',
    method: 'POST',
    scope: 'telegram:write',
    tier: 'PRO',
    summary: 'Schedule a Telegram broadcast',
    requestBody: { required: true, schema: { type: 'object' } },
    responses: { '2xx': standard2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/telegram/broadcasts', method: 'POST' },
    emits: ['telegram.broadcast.scheduled'],
    idempotent: true,
  },

  /* ── Channels ─────────────────────────────────────────────────────────── */
  {
    module: 'telegram',
    resource: 'channels',
    verb: 'list',
    path: '/telegram/channels',
    method: 'GET',
    scope: 'telegram:read',
    tier: 'FREE',
    summary: 'List Telegram channels',
    responses: { '2xx': standard2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/telegram/channels', method: 'GET' },
  },

  /* ── Chats ────────────────────────────────────────────────────────────── */
  {
    module: 'telegram',
    resource: 'chats',
    verb: 'list',
    path: '/telegram/chats',
    method: 'GET',
    scope: 'telegram:read',
    tier: 'FREE',
    summary: 'List Telegram chats',
    responses: { '2xx': standard2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: '/v1/telegram/chats', method: 'GET' },
  },
];
