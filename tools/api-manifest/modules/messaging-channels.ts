/**
 * Additional messaging channels beyond WhatsApp / SMS / Telegram —
 * email, push notifications, voice calling,
 * SabChat, in-app integrations / connectors.
 */

import type { EndpointSpec } from '../types';
import { crudExtendedResource } from '../crud-extended';

const generic2xx = { description: 'OK', schema: { type: 'object' as const } };
const auth = {
  '401': { description: 'Missing or invalid API key' },
  '429': { description: 'Rate limit exceeded' },
};

function customPost(
  module: string,
  resource: string,
  path: string,
  rustPath: string,
  scope: string,
  summary: string,
  options: { credits?: number; idempotent?: boolean; emits?: string[] } = {},
): EndpointSpec {
  return {
    module,
    resource,
    verb: 'custom',
    path,
    method: 'POST',
    scope,
    tier: 'FREE',
    summary,
    requestBody: { required: true, schema: { type: 'object' } },
    responses: { '2xx': generic2xx, ...auth },
    delegate: { kind: 'rust-fwd', path: rustPath, method: 'POST' },
    ...(options.credits ? { credits: options.credits } : {}),
    ...(options.idempotent ? { idempotent: true } : {}),
    ...(options.emits ? { emits: options.emits } : {}),
  };
}

export const messagingChannelsEndpoints: ReadonlyArray<EndpointSpec> = [
  /* ── Email ────────────────────────────────────────────────────────────── */
  ...crudExtendedResource({
    module: 'email',
    resource: 'templates',
    basePath: '/email/templates',
    rustPath: '/v1/email/templates',
    scopeRead: 'email:read',
    scopeWrite: 'email:write',
  }),
  ...crudExtendedResource({
    module: 'email',
    resource: 'campaigns',
    basePath: '/email/campaigns',
    rustPath: '/v1/email/campaigns',
    scopeRead: 'email:read',
    scopeWrite: 'email:write',
  }),
  ...crudExtendedResource({
    module: 'email',
    resource: 'lists',
    basePath: '/email/lists',
    rustPath: '/v1/email/lists',
    scopeRead: 'email:read',
    scopeWrite: 'email:write',
  }),
  ...crudExtendedResource({
    module: 'email',
    resource: 'subscribers',
    basePath: '/email/subscribers',
    rustPath: '/v1/email/subscribers',
    scopeRead: 'email:read',
    scopeWrite: 'email:write',
  }),
  ...crudExtendedResource({
    module: 'email',
    resource: 'suppressions',
    basePath: '/email/suppressions',
    rustPath: '/v1/email/suppressions',
    scopeRead: 'email:read',
    scopeWrite: 'email:write',
  }),
  customPost('email', 'send', '/email/send', '/v1/email/send', 'email:send', 'Send a transactional email', { credits: 1, idempotent: true, emits: ['email.sent'] }),
  customPost('email', 'send-bulk', '/email/send-bulk', '/v1/email/send-bulk', 'email:send', 'Send a bulk email blast', { idempotent: true, emits: ['email.bulk.queued'] }),

  /* ── Push notifications ──────────────────────────────────────────────── */
  ...crudExtendedResource({
    module: 'notifications',
    resource: 'devices',
    basePath: '/notifications/devices',
    rustPath: '/v1/notifications/devices',
    scopeRead: 'notifications:read',
    scopeWrite: 'notifications:write',
  }),
  ...crudExtendedResource({
    module: 'notifications',
    resource: 'topics',
    basePath: '/notifications/topics',
    rustPath: '/v1/notifications/topics',
    scopeRead: 'notifications:read',
    scopeWrite: 'notifications:write',
  }),
  ...crudExtendedResource({
    module: 'notifications',
    resource: 'preferences',
    basePath: '/notifications/preferences',
    rustPath: '/v1/notifications/preferences',
    scopeRead: 'notifications:read',
    scopeWrite: 'notifications:write',
    idParam: 'preferenceId',
  }),
  customPost('notifications', 'send-push', '/notifications/send', '/v1/notifications/send', 'notifications:send', 'Send a push notification', { credits: 1, idempotent: true, emits: ['notification.sent'] }),

  /* ── Voice / calling ─────────────────────────────────────────────────── */
  ...crudExtendedResource({
    module: 'calling',
    resource: 'calls',
    basePath: '/calling/calls',
    rustPath: '/v1/calling/calls',
    scopeRead: 'calls:read',
    scopeWrite: 'calls:write',
  }),
  ...crudExtendedResource({
    module: 'calling',
    resource: 'recordings',
    basePath: '/calling/recordings',
    rustPath: '/v1/calling/recordings',
    scopeRead: 'calls:read',
    scopeWrite: 'calls:write',
  }),
  customPost('calling', 'initiate', '/calling/initiate', '/v1/calling/initiate', 'calls:write', 'Initiate an outbound call', { credits: 1, idempotent: true, emits: ['call.initiated'] }),
  customPost('calling', 'hangup', '/calling/hangup', '/v1/calling/hangup', 'calls:write', 'Hang up an in-progress call'),

  /* ── SabChat (web chat widget) ───────────────────────────────────────── */
  ...crudExtendedResource({
    module: 'sabchat',
    resource: 'bots',
    basePath: '/sabchat/bots',
    rustPath: '/v1/sabchat/bots',
    scopeRead: 'sabchat:read',
    scopeWrite: 'sabchat:write',
  }),
  ...crudExtendedResource({
    module: 'sabchat',
    resource: 'conversations',
    basePath: '/sabchat/conversations',
    rustPath: '/v1/sabchat/conversations',
    scopeRead: 'sabchat:read',
    scopeWrite: 'sabchat:write',
  }),
  ...crudExtendedResource({
    module: 'sabchat',
    resource: 'messages',
    basePath: '/sabchat/messages',
    rustPath: '/v1/sabchat/messages',
    scopeRead: 'sabchat:read',
    scopeWrite: 'sabchat:write',
  }),
  ...crudExtendedResource({
    module: 'sabchat',
    resource: 'channels',
    basePath: '/sabchat/channels',
    rustPath: '/v1/sabchat/channels',
    scopeRead: 'sabchat:read',
    scopeWrite: 'sabchat:write',
  }),

  /* ── Integrations + connectors ───────────────────────────────────────── */
  ...crudExtendedResource({
    module: 'integrations',
    resource: 'connections',
    basePath: '/integrations/connections',
    rustPath: '/v1/integrations/connections',
    scopeRead: 'integrations:read',
    scopeWrite: 'integrations:write',
  }),
  ...crudExtendedResource({
    module: 'integrations',
    resource: 'oauth-providers',
    basePath: '/integrations/oauth-providers',
    rustPath: '/v1/integrations/oauth-providers',
    scopeRead: 'integrations:read',
    scopeWrite: 'integrations:write',
    idParam: 'oauthProviderId',
  }),
  ...crudExtendedResource({
    module: 'integrations',
    resource: 'webhooks-inbound',
    basePath: '/integrations/webhooks-inbound',
    rustPath: '/v1/integrations/webhooks-inbound',
    scopeRead: 'integrations:read',
    scopeWrite: 'integrations:write',
    idParam: 'inboundWebhookId',
  }),
];
