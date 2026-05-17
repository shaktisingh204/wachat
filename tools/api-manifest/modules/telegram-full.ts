/**
 * Complete Telegram surface — every `/v1/telegram/*` Rust crate.
 * Extends `telegram.ts` which only covered bots/broadcasts/channels/chats.
 */

import type { EndpointSpec } from '../types';
import { crudResource } from '../crud-template';

const t = (
  resource: string,
  basePath: string,
  rustPath: string,
  scope: 'telegram:read' | 'telegram:write' = 'telegram:read',
  options: Partial<{ idParam: string; display: string }> = {},
): EndpointSpec[] =>
  crudResource({
    module: 'telegram',
    resource,
    basePath,
    rustPath,
    scopeRead: 'telegram:read',
    scopeWrite: scope === 'telegram:read' ? 'telegram:write' : scope,
    idParam: options.idParam,
    display: options.display,
  });

export const telegramFullEndpoints: ReadonlyArray<EndpointSpec> = [
  ...t('analytics', '/telegram/analytics', '/v1/telegram/analytics', 'telegram:write', { idParam: 'analyticsId' }),
  ...t('api-credentials', '/telegram/api-credentials', '/v1/telegram/api-credentials', 'telegram:write', { idParam: 'apiCredentialId' }),
  ...t('auto-reply', '/telegram/auto-reply', '/v1/telegram/auto-reply', 'telegram:write', { idParam: 'autoReplyId' }),
  ...t('bot-profile', '/telegram/bot-profile', '/v1/telegram/bot-profile', 'telegram:write', { idParam: 'botProfileId' }),
  ...t('business-inbox', '/telegram/business-inbox', '/v1/telegram/business-inbox', 'telegram:write', { idParam: 'businessInboxId' }),
  ...t('commands', '/telegram/commands', '/v1/telegram/commands', 'telegram:write'),
  ...t('contacts', '/telegram/contacts', '/v1/telegram/contacts', 'telegram:write'),
  ...t('flows', '/telegram/flows', '/v1/telegram/flows', 'telegram:write'),
  ...t('mini-apps', '/telegram/mini-apps', '/v1/telegram/mini-apps', 'telegram:write', { idParam: 'miniAppId' }),
  ...t('payments', '/telegram/payments', '/v1/telegram/payments', 'telegram:write'),
  ...t('settings', '/telegram/settings', '/v1/telegram/settings', 'telegram:write', { idParam: 'settingId' }),
  ...t('stickers', '/telegram/stickers', '/v1/telegram/stickers', 'telegram:write'),
  ...t('stories', '/telegram/stories', '/v1/telegram/stories', 'telegram:write'),
  ...t('telegram-ads', '/telegram/ads', '/v1/telegram/ads', 'telegram:write', { idParam: 'adId', display: 'Telegram ads' }),
  ...t('webhooks-config', '/telegram/webhooks', '/v1/telegram/webhooks', 'telegram:write', { idParam: 'webhookId', display: 'Telegram bot webhooks' }),
];
