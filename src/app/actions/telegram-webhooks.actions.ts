'use server';

/**
 * Server-action shims for the Rust `telegram-webhooks` crate.
 *
 * Each body is a thin wrapper around `rustClient.telegramWebhooks.*`.
 * Failures surface as a stringy `error` field on the payload so the
 * client page can render them inline without exception handling.
 */

import { rustClient } from '@/lib/rust-client';
import { getErrorMessage } from '@/lib/utils';
import type {
    AnalyticsQuery,
    AnalyticsResp,
    DeleteDeliveriesResp,
    DeleteSubscriptionBody,
    GetDeliveryResp,
    GetSubscriptionResp,
    ListDeliveriesQuery,
    ListDeliveriesResp,
    ListDlqQuery,
    ListDlqResp,
    ListSubscriptionsResp,
    LogDeliveryBody,
    PutSubscriptionBody,
    TestSubscriptionResp,
    WebhookAckResult,
} from '@/lib/rust-client/telegram-webhooks';


// ---------------------------------------------------------------------------
//  Subscriptions
// ---------------------------------------------------------------------------

export async function listTelegramWebhookSubscriptionsAction(
    projectId: string,
    botId?: string,
): Promise<ListSubscriptionsResp> {
    if (!projectId) return { subscriptions: [], error: 'projectId is required' };
    try {
        return await rustClient.telegramWebhooks.listSubscriptions(projectId, botId);
    } catch (e) {
        return { subscriptions: [], error: getErrorMessage(e) };
    }
}

export async function getTelegramWebhookSubscriptionAction(
    botId: string,
    projectId: string,
): Promise<GetSubscriptionResp> {
    if (!projectId) return { error: 'projectId is required' };
    if (!botId) return { error: 'botId is required' };
    try {
        return await rustClient.telegramWebhooks.getSubscription(botId, projectId);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function putTelegramWebhookSubscriptionAction(
    botId: string,
    body: PutSubscriptionBody,
): Promise<WebhookAckResult> {
    if (!body.projectId) return { success: false, error: 'projectId is required' };
    if (!botId) return { success: false, error: 'botId is required' };
    try {
        return await rustClient.telegramWebhooks.putSubscription(botId, body);
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteTelegramWebhookSubscriptionAction(
    botId: string,
    body: DeleteSubscriptionBody,
): Promise<WebhookAckResult> {
    if (!body.projectId) return { success: false, error: 'projectId is required' };
    if (!botId) return { success: false, error: 'botId is required' };
    try {
        return await rustClient.telegramWebhooks.deleteSubscription(botId, body);
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function testTelegramWebhookSubscriptionAction(
    botId: string,
    projectId: string,
): Promise<TestSubscriptionResp> {
    if (!projectId) return { success: false, error: 'projectId is required' };
    if (!botId) return { success: false, error: 'botId is required' };
    try {
        return await rustClient.telegramWebhooks.testSubscription(botId, projectId);
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function rotateTelegramWebhookSecretAction(
    botId: string,
    projectId: string,
): Promise<WebhookAckResult> {
    if (!projectId) return { success: false, error: 'projectId is required' };
    if (!botId) return { success: false, error: 'botId is required' };
    try {
        return await rustClient.telegramWebhooks.rotateSecret(botId, projectId);
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// ---------------------------------------------------------------------------
//  Deliveries
// ---------------------------------------------------------------------------

export async function listTelegramWebhookDeliveriesAction(
    q: ListDeliveriesQuery,
): Promise<ListDeliveriesResp> {
    if (!q.projectId) return { deliveries: [], nextCursor: null, error: 'projectId is required' };
    try {
        return await rustClient.telegramWebhooks.listDeliveries(q);
    } catch (e) {
        return { deliveries: [], nextCursor: null, error: getErrorMessage(e) };
    }
}

export async function getTelegramWebhookDeliveryAction(
    id: string,
    projectId: string,
): Promise<GetDeliveryResp> {
    if (!projectId) return { error: 'projectId is required' };
    if (!id) return { error: 'delivery id is required' };
    try {
        return await rustClient.telegramWebhooks.getDelivery(id, projectId);
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function replayTelegramWebhookDeliveryAction(
    id: string,
    projectId: string,
): Promise<WebhookAckResult> {
    if (!projectId) return { success: false, error: 'projectId is required' };
    if (!id) return { success: false, error: 'delivery id is required' };
    try {
        return await rustClient.telegramWebhooks.replayDelivery(id, projectId);
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteTelegramWebhookDeliveriesAction(
    projectId: string,
    before?: string,
): Promise<DeleteDeliveriesResp> {
    if (!projectId) return { success: false, deleted: 0, error: 'projectId is required' };
    try {
        return await rustClient.telegramWebhooks.deleteDeliveries(projectId, before);
    } catch (e) {
        return { success: false, deleted: 0, error: getErrorMessage(e) };
    }
}

// Internal — invoked by `/api/telegram/webhook/[botId]` after persisting
// each incoming update. Errors are swallowed by callers (best-effort log).
export async function logTelegramWebhookDeliveryAction(
    body: LogDeliveryBody,
): Promise<WebhookAckResult> {
    try {
        return await rustClient.telegramWebhooks.logDelivery(body);
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// ---------------------------------------------------------------------------
//  DLQ
// ---------------------------------------------------------------------------

export async function listTelegramWebhookDlqAction(
    q: ListDlqQuery,
): Promise<ListDlqResp> {
    if (!q.projectId) return { items: [], nextCursor: null, error: 'projectId is required' };
    try {
        return await rustClient.telegramWebhooks.listDlq(q);
    } catch (e) {
        return { items: [], nextCursor: null, error: getErrorMessage(e) };
    }
}

export async function retryTelegramWebhookDlqAction(
    id: string,
    projectId: string,
): Promise<WebhookAckResult> {
    if (!projectId) return { success: false, error: 'projectId is required' };
    if (!id) return { success: false, error: 'dlq id is required' };
    try {
        return await rustClient.telegramWebhooks.retryDlq(id, projectId);
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function resolveTelegramWebhookDlqAction(
    id: string,
    projectId: string,
): Promise<WebhookAckResult> {
    if (!projectId) return { success: false, error: 'projectId is required' };
    if (!id) return { success: false, error: 'dlq id is required' };
    try {
        return await rustClient.telegramWebhooks.resolveDlq(id, projectId);
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteTelegramWebhookDlqAction(
    id: string,
    projectId: string,
): Promise<WebhookAckResult> {
    if (!projectId) return { success: false, error: 'projectId is required' };
    if (!id) return { success: false, error: 'dlq id is required' };
    try {
        return await rustClient.telegramWebhooks.deleteDlq(id, projectId);
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// ---------------------------------------------------------------------------
//  Analytics
// ---------------------------------------------------------------------------

export async function getTelegramWebhookAnalyticsAction(
    q: AnalyticsQuery,
): Promise<AnalyticsResp> {
    if (!q.projectId) {
        return {
            totalReceived: 0,
            totalProcessed: 0,
            totalFailed: 0,
            dlqCount: 0,
            avgProcessingMs: 0,
            byEventType: [],
            byDay: [],
            error: 'projectId is required',
        };
    }
    try {
        return await rustClient.telegramWebhooks.analytics(q);
    } catch (e) {
        return {
            totalReceived: 0,
            totalProcessed: 0,
            totalFailed: 0,
            dlqCount: 0,
            avgProcessingMs: 0,
            byEventType: [],
            byDay: [],
            error: getErrorMessage(e),
        };
    }
}
