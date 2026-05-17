/**
 * `webhook` action handler.
 *
 * STUBBED on purpose: real outbound HTTP must go through the existing
 * SabNode webhook dispatcher (`src/lib/webhook-dispatcher.ts` or equivalent
 * — TBD), which adds signing, retries with exponential backoff, dead-letter
 * routing, and tenant-level rate limits. Wiring TODO:
 *
 *   import { dispatchOutboundWebhook } from '@/lib/webhook-dispatcher';
 *   await dispatchOutboundWebhook({
 *       tenantUserId: ctx.automation.userId,
 *       source: { kind: 'automation', id: ctx.automation._id },
 *       url: cfg.url,
 *       method: cfg.method ?? 'POST',
 *       headers: cfg.headers,
 *       body: cfg.body ?? { entity: ctx.entity, event: ctx.event },
 *   });
 *
 * Until then we structured-log the request so operators can confirm
 * automations are queuing webhooks correctly.
 */

import type { WebhookActionConfig } from '../types';
import type { ActionContext } from './index';

export async function webhookAction(
    cfg: WebhookActionConfig,
    ctx: ActionContext,
): Promise<string> {
    if (!cfg.url) throw new Error('webhook: url is required');

    const body = cfg.body ?? { entity: ctx.entity, event: ctx.event };

    console.log('[automation:webhook] STUB — outbound HTTP not yet wired', {
        automationId: ctx.automation._id,
        userId: ctx.automation.userId,
        url: cfg.url,
        method: cfg.method ?? 'POST',
        headers: cfg.headers,
        bodyPreview: JSON.stringify(body).slice(0, 500),
    });

    return `Logged webhook ${cfg.method ?? 'POST'} ${cfg.url}`;
}
